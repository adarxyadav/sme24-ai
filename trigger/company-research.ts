import { logger, task } from "@trigger.dev/sdk";
import { cacheKey } from "@/lib/runs/cache-key";
import { agentLog, LOG_MESSAGES } from "@/lib/runs/agent-log";
import {
  buildResearchEnvelope,
  findCachedResearch,
  isNoData,
  type ResearchEnvelope,
} from "@/lib/runs/research";
import { researchCompany, type ProcessorTier } from "@/lib/parallel/client";
import { createServiceClient } from "@/lib/supabase/service";
import { COMPANY_RESEARCH_QUEUE } from "@/lib/runs/queues";

// Stage 1 — company research (pipeline-rules.md, Stages; t-004-spec.md).
// Order is the contract's: client KPIs already exist (written by the trigger
// route), then the cache check, then Parallel on a miss.

const STAGE = "research";

// The queue's limit is declared here, on the task — the name itself lives in
// lib/runs/queues.ts so the route can reference it without importing this
// module. concurrencyKey (set per trigger, from userId) splits this one queue
// into an independent sub-queue per user, each carrying the limit —
// pipeline-rules.md, Quota: "one run at a time per user."

// Bounds the Parallel result loop below the task's own ceiling, so a stuck
// provider run surfaces as our timeout rather than as a killed task.
const TASK_MAX_DURATION_SECONDS = 1800;
const PARALLEL_MAX_WAIT_SECONDS = 1500;

type Payload = { runId: string };

type RunRow = {
  id: string;
  company_name: string;
  company_domain: string | null;
  processor: ProcessorTier;
  status: string;
  uploaded_report_path: string | null;
};

export const companyResearchTask = task({
  id: "company-research",
  maxDuration: TASK_MAX_DURATION_SECONDS,
  queue: { name: COMPANY_RESEARCH_QUEUE, concurrencyLimit: 1 },
  retry: {
    maxAttempts: 3,
    // pipeline-rules.md, Escalation: model-call retry backoff >= 60s.
    minTimeoutInMs: 60_000,
    maxTimeoutInMs: 300_000,
    factor: 2,
    randomize: true,
  },

  run: async ({ runId }: Payload, { signal }) => {
    const service = createServiceClient();

    // A testing seam, not shipped behaviour — it sits alongside PIPELINE_MODEL,
    // which library-docs.md already establishes as a testing-only override.
    // Verifies the failure path (t-004-spec.md D12, seam 3).
    if (process.env.FORCE_STAGE1_FAILURE) {
      throw new Error("Forced stage 1 failure (FORCE_STAGE1_FAILURE)");
    }

    const { data: run, error: runError } = await service
      .from("analysis_runs")
      .select("id, company_name, company_domain, processor, status, uploaded_report_path")
      .eq("id", runId)
      .maybeSingle<RunRow>();

    if (runError) throw new Error(`run lookup failed: ${runError.message}`);
    if (!run) throw new Error(`run ${runId} not found`);

    // Claiming the run, not just advancing it. The conditional update is the
    // whole safety story for T-010's sweeper: `queued -> researching` succeeds
    // for exactly one caller, so a run triggered twice (route enqueue plus a
    // sweep that raced it) has one winner and the loser exits here. The guard
    // is the database's, not Trigger.dev's idempotency store — that store
    // clears a failed run's key and expires at 30 days, so it cannot be the
    // authority on whether our work already started.
    //
    // The state machine only moves forward: an escalation re-run keeps the run
    // in its current status (pipeline-rules.md), so a run already past `queued`
    // is never walked backwards, and an escalation re-run is not a duplicate.
    if (run.status === "queued") {
      const { data: claimed, error: claimError } = await service
        .from("analysis_runs")
        .update({ status: "researching" })
        .eq("id", runId)
        .eq("status", "queued")
        .select("id")
        .maybeSingle<{ id: string }>();

      if (claimError) throw new Error(`run claim failed: ${claimError.message}`);

      if (!claimed) {
        // Another trigger for this same run got there first. Returning rather
        // than throwing: this is the guard working, not a failure, and throwing
        // would spend retries and end at onFailure marking a healthy run failed.
        await agentLog(service, {
          runId,
          stage: STAGE,
          level: "warn",
          message: LOG_MESSAGES.alreadyClaimed,
          payload: {},
        });
        logger.log("stage 1 skipped, run already claimed", { runId });
        return { runId, skipped: true as const };
      }
    }

    // Step 1 — client KPIs. Already written by the trigger route inside
    // create_analysis_run (t-003-spec.md D8/D9), so this reads and asserts;
    // it writes nothing, which is what makes an escalation re-run idempotent
    // here (t-004-spec.md D4).
    const { data: clientKpis, error: kpiError } = await service
      .from("kpis")
      .select("metric, value, period")
      .eq("run_id", runId)
      .eq("origin", "client");

    if (kpiError) throw new Error(`client kpi read failed: ${kpiError.message}`);
    const clientKpiCount = clientKpis?.length ?? 0;

    await agentLog(service, {
      runId,
      stage: STAGE,
      // The rows exist or the run does not — both were written in one
      // transaction. Nothing repairs them here; a gap is a transaction bug.
      level: "info",
      message: LOG_MESSAGES.clientKpis,
      payload: { count: clientKpiCount },
    });

    // Step 2 — cache check. cacheKey() is imported, never re-implemented, so the
    // route and this task cannot drift apart (t-003-spec.md D2).
    const key = cacheKey({
      companyName: run.company_name,
      companyDomain: run.company_domain,
    });

    const cached = await findCachedResearch(service, {
      cacheKey: key,
      runId,
      processor: run.processor,
    });

    let research: ResearchEnvelope;

    if (cached.hit) {
      await agentLog(service, {
        runId,
        stage: STAGE,
        message: LOG_MESSAGES.cacheHit,
        payload: { donor_run_id: cached.donorRunId, age_days: cached.ageDays, cache_key: key },
      });
      research = cached.research;
    } else {
      await agentLog(service, {
        runId,
        stage: STAGE,
        message: LOG_MESSAGES.cacheMiss,
        payload: { cache_key: key, reason: cached.reason },
      });

      // Step 3 — Parallel. Public identifiers only: no runId, no user_id, no
      // client KPI values (pipeline-rules.md hard rule).
      const result = await researchCompany({
        companyName: run.company_name,
        companyDomain: run.company_domain,
        processor: run.processor,
        maxWaitSeconds: PARALLEL_MAX_WAIT_SECONDS,
        // Aborts the in-flight Parallel request when the run is cancelled.
        signal,
      });

      await agentLog(service, {
        runId,
        stage: STAGE,
        message: LOG_MESSAGES.parallelCreated,
        payload: { parallel_run_id: result.parallelRunId, processor: run.processor },
      });

      research = buildResearchEnvelope({
        output: result.output,
        basis: result.basis,
        parallelRunId: result.parallelRunId,
        processor: run.processor,
      });
    }

    // Step 4 — the uploaded PDF override is scoped out of T-004 (spec D10): no
    // Storage bucket exists and nothing populates uploaded_report_path, so the
    // condition is evaluated for real and is always false today.
    const hasUpload = run.uploaded_report_path !== null;

    const noData = isNoData({ output: research.output, clientKpiCount, hasUpload });

    const { error: writeError } = await service
      .from("analysis_runs")
      .update({
        research,
        // no_data is a terminal, so it carries completed_at. Otherwise the run
        // stays `researching`: stage 2 (T-005) owns reaching `completed`, and
        // writing it here would claim a finished report with no kpis rows.
        ...(noData ? { status: "no_data", completed_at: new Date().toISOString() } : {}),
      })
      .eq("id", runId);

    if (writeError) throw new Error(`research write failed: ${writeError.message}`);

    await agentLog(service, {
      runId,
      stage: STAGE,
      message: noData ? LOG_MESSAGES.noData : LOG_MESSAGES.researchStored,
      payload: {
        source: research.source,
        findings: research.output.findings.length,
        sector: research.output.sector.nace_code,
        client_kpis: clientKpiCount,
      },
    });

    logger.log("stage 1 complete", { runId, source: research.source, noData });

    return { runId, source: research.source, noData, findings: research.output.findings.length };
  },

  // Cancellation is not failure and does not reach onFailure — the SDK docs are
  // explicit that the hook does not fire for Canceled, Crashed or system
  // failures. Without this, a run cancelled mid-research (a stalled worker, a
  // redeploy, maxDuration) would sit at `researching` forever with no terminal
  // status for the read layer to render.
  //
  // It writes `failed` rather than a new status: the run state machine
  // (pipeline-rules.md) has no `cancelled`, and adding one is a schema change
  // outside T-004. The error column says what happened.
  onCancel: async ({ payload }) => {
    const { runId } = payload as Payload;
    const service = createServiceClient();

    // Only from a non-terminal status: a cancellation racing a completed write
    // must not overwrite a good result.
    const { error: statusError } = await service
      .from("analysis_runs")
      .update({
        status: "failed",
        error: "Run cancelled before stage 1 completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", runId)
      .in("status", ["queued", "researching"]);

    if (statusError) {
      logger.error("failed to mark cancelled run", { runId, message: statusError.message });
    }

    await agentLog(service, {
      runId,
      stage: STAGE,
      level: "warn",
      message: LOG_MESSAGES.cancelled,
      payload: {},
    });
  },

  // Fires once, after retries are exhausted — the only writer of `failed`
  // (pipeline-rules.md: "set by the failing task's final-failure hook").
  // A catch inside run() would mark a run failed on its first attempt, then be
  // contradicted by a retry that succeeds.
  onFailure: async ({ payload, error }) => {
    const { runId } = payload as Payload;
    const service = createServiceClient();

    const cause = error instanceof Error ? error : new Error(String(error));
    // Internal-facing, and no read path exposes it: lib/portal/runs.ts selects
    // an explicit column list that omits `error`, and T-006 renders a generic
    // notice for failed runs.
    const summary = `${cause.name}: ${cause.message}`.slice(0, 500);

    // The hook cannot itself be retried, so a write failure is reported and
    // never masks the original error.
    const { error: statusError } = await service
      .from("analysis_runs")
      .update({ status: "failed", error: summary, completed_at: new Date().toISOString() })
      .eq("id", runId);

    if (statusError) {
      logger.error("failed to mark run failed", { runId, message: statusError.message });
    }

    await agentLog(service, {
      runId,
      stage: STAGE,
      level: "error",
      message: LOG_MESSAGES.failed,
      payload: { name: cause.name, message: cause.message, stack: cause.stack ?? null },
    });
  },
});
