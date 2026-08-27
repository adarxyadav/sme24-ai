import { NextResponse, type NextRequest } from "next/server";
import { tasks } from "@trigger.dev/sdk";
import { z } from "zod";
import { CANONICAL_METRICS, type CanonicalMetric } from "@/lib/runs/metrics";
import { cacheKey } from "@/lib/runs/cache-key";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { ownsUploadPath, UPLOADS_BUCKET } from "@/lib/upload/bucket";
import { agentLog, LOG_MESSAGES } from "@/lib/runs/agent-log";
import { COMPANY_RESEARCH_QUEUE } from "@/lib/runs/queues";
// Type-only, and deliberately so: it types the payload without evaluating the
// task module, which would pull the Parallel client and the service-role client
// into this route. The queue name is a value, so it lives in lib/ instead.
import type { companyResearchTask } from "@/trigger/company-research";

// The trigger route (pipeline-rules.md, "Trigger route"). Order is fixed:
// authenticate, validate shape, compute cache_key, write, enqueue, return
// runId. It never calls AI itself — it hands off to the stage-1 task.

// No z.coerce anywhere: coercion turns "" into 0, which would record zero
// fatalities as a client-supplied fact at confidence 'high' — a fabricated
// disclosure (pipeline-rules.md: never present a guessed number as fact).
const rateValue = z.number().nonnegative();
const countValue = z.number().int().nonnegative();

// Spelled out rather than mapped over the metric lists: discriminatedUnion
// needs a statically-known tuple, and a spread array widens every branch to
// unknown. CANONICAL_METRICS still owns the list — the check below fails the
// build if a metric is added there and forgotten here.
const kpiSchema = z.discriminatedUnion("metric", [
  z.object({ metric: z.literal("TRIR"), value: rateValue }),
  z.object({ metric: z.literal("LTIFR"), value: rateValue }),
  z.object({ metric: z.literal("total_recordable_injuries"), value: countValue }),
  z.object({ metric: z.literal("lost_time_injuries"), value: countValue }),
  z.object({ metric: z.literal("fatalities"), value: countValue }),
  z.object({ metric: z.literal("near_misses"), value: countValue }),
  z.object({ metric: z.literal("hours_worked"), value: countValue }),
]);

type ValidatedKpi = z.infer<typeof kpiSchema>;

// Fails the build if the branches above and CANONICAL_METRICS ever diverge, in
// either direction — a metric added to the contract without a branch, or a
// branch naming a metric the contract does not carry.
type MetricsMatch<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const _metricCoverage: MetricsMatch<ValidatedKpi["metric"], CanonicalMetric> = true;
void _metricCoverage;

// user_id is never accepted from the body — it comes from the verified session
// (t-003-spec.md D3). strict() makes a body carrying one malformed rather than
// silently ignored.
const bodySchema = z
  .object({
    companyName: z.string().trim().min(1).max(200),
    companyDomain: z.string().trim().max(253).optional(),
    reportingPeriod: z.string().trim().max(100).optional(),
    kpis: z.array(kpiSchema).max(CANONICAL_METRICS.length).optional(),
    uploadedReportPath: z.string().max(200).optional(),
  })
  .strict();

// One generic sentence per AGENTS.md — no field-level detail crosses the wire.
function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

const INVALID = "Please check the form and try again.";

// The stage the enqueue belongs to, so a failed handoff logs against the same
// stage the task itself would have.
const STAGE = "research";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return fail("Please sign in to run a search.", 401);

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return fail(INVALID, 400);
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) return fail(INVALID, 400);
  const { companyName, companyDomain, reportingPeriod, kpis, uploadedReportPath } = parsed.data;

  // A duplicate metric is only reachable from a hand-rolled POST; the form
  // cannot produce one. Compared as a set so the array carries each metric once.
  const metrics = (kpis ?? []).map((kpi) => kpi.metric);
  if (new Set(metrics).size !== metrics.length) return fail(INVALID, 400);

  const key = cacheKey({ companyName, companyDomain });

  const service = createServiceClient();

  // An uploaded report is accepted only from the caller's own folder and only
  // if the object exists — the path is client input (pipeline-rules.md,
  // Trigger route; t-020-spec.md D1).
  if (uploadedReportPath !== undefined) {
    if (!ownsUploadPath(userId, uploadedReportPath)) return fail(INVALID, 400);
    const [folder, name] = uploadedReportPath.split("/");
    const { data: objects, error: listError } = await service.storage
      .from(UPLOADS_BUCKET)
      .list(folder, { search: name, limit: 1 });
    if (listError || !objects?.some((object) => object.name === name)) return fail(INVALID, 400);
  }

  // Both writes in one transaction (t-003-spec.md D9): a run whose client KPIs
  // went missing would be researched as though the client supplied nothing.
  const { data: runId, error } = await service.rpc("create_analysis_run", {
    p_user_id: userId,
    p_company_name: companyName,
    p_company_domain: companyDomain ?? null,
    p_cache_key: key,
    p_kpis: (kpis ?? []).map((kpi) => ({
      metric: kpi.metric,
      value: kpi.value,
      period: reportingPeriod ?? null,
    })),
    p_uploaded_report_path: uploadedReportPath ?? null,
  });

  if (error || typeof runId !== "string") {
    console.error("create_analysis_run failed", error?.message);
    return fail("We could not start your search. Please try again.", 500);
  }

  // Enqueued after the write, never before: a task must not start against a run
  // row that does not exist yet.
  //
  // Best-effort, and deliberately so (T-010, superseding t-004-spec.md D2). The
  // committed row is the source of truth for "work exists" — `queued` means no
  // task has claimed it yet — so a failed enqueue is a delay, not a failed
  // request. Returning 500 here would report a run that genuinely exists as
  // never started, and the form's resubmit would then create a second one. The
  // sweeper re-triggers whatever this misses.
  try {
    // A testing seam, alongside FORCE_STAGE1_FAILURE — it proves the branch
    // below without needing Trigger.dev to be genuinely unreachable (T-010).
    if (process.env.FORCE_ENQUEUE_FAILURE) {
      throw new Error("Forced enqueue failure (FORCE_ENQUEUE_FAILURE)");
    }

    await tasks.trigger<typeof companyResearchTask>(
      "company-research",
      { runId, reason: "start" as const },
      {
        // The queue is declared on the task with its concurrencyLimit of 1;
        // concurrencyKey splits it into an independent sub-queue per user, so a
        // user's second search waits rather than running alongside the first
        // (pipeline-rules.md, Quota).
        queue: COMPANY_RESEARCH_QUEUE,
        concurrencyKey: userId,
        // Explicit, though the project default is the same: customer data stays
        // in EU regions, and a dashboard default is invisible in the repo
        // (t-004-spec.md D1).
        region: "eu-central-1",
      },
    );
  } catch (triggerError) {
    // The agent_logs row is what makes this recoverable rather than merely
    // logged: the sweeper counts these to decide when a run has failed to
    // enqueue often enough to be terminated (T-010).
    const cause =
      triggerError instanceof Error ? triggerError.message : String(triggerError);
    await agentLog(service, {
      runId,
      stage: STAGE,
      level: "warn",
      message: LOG_MESSAGES.enqueueFailed,
      payload: { source: "route", cause: cause.slice(0, 500) },
    });
  }

  return NextResponse.json({ runId }, { status: 201 });
}
