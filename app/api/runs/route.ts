import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { CANONICAL_METRICS, type CanonicalMetric } from "@/lib/runs/metrics";
import { cacheKey } from "@/lib/runs/cache-key";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

// The trigger route (pipeline-rules.md, "Trigger route"). Order is fixed:
// authenticate, validate shape, compute cache_key, write, return runId. It
// never calls AI, and T-003 stops before enqueuing stage 1.

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
  })
  .strict();

// One generic sentence per AGENTS.md — no field-level detail crosses the wire.
function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

const INVALID = "Please check the form and try again.";

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
  const { companyName, companyDomain, reportingPeriod, kpis } = parsed.data;

  // A duplicate metric is only reachable from a hand-rolled POST; the form
  // cannot produce one. Compared as a set so the array carries each metric once.
  const metrics = (kpis ?? []).map((kpi) => kpi.metric);
  if (new Set(metrics).size !== metrics.length) return fail(INVALID, 400);

  const key = cacheKey({ companyName, companyDomain });

  // Both writes in one transaction (t-003-spec.md D9): a run whose client KPIs
  // went missing would be researched as though the client supplied nothing.
  const service = createServiceClient();
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
  });

  if (error || typeof runId !== "string") {
    console.error("create_analysis_run failed", error?.message);
    return fail("We could not start your search. Please try again.", 500);
  }

  return NextResponse.json({ runId }, { status: 201 });
}
