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
import { kpiExtractionTask } from "@/trigger/kpi-extraction";
import { peerBenchmarkingTask } from "@/trigger/peer-benchmarking";

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

// `reason` says why this task was triggered, because the run's status alone
// cannot distinguish the two ways a task legitimately starts on a non-`queued`
// run. A `start` is the first attempt at the work and must happen exactly once:
// route enqueue and sweeper re-trigger both send it, and only one may proceed.
// An `escalation` is a deliberate re-entry at the current status
// (pipeline-rules.md, Escalation) and is never a duplicate.
type TriggerReason = "start" | "escalation";

const HANG_MS = 10 * 60_000;

function sleepUntilAborted(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}
type Payload = { runId: string; reason?: TriggerReason };

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

  run: async ({ runId, reason = "start" }: Payload, { ctx, signal }) => {
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

    // Claiming the run, not just advancing it. `queued -> researching` succeeds
    // for exactly one caller, so of the triggers that mean "start this work" —
    // the route's enqueue and any sweeper re-trigger — one wins and the rest
    // exit here. The guard is the database's, not Trigger.dev's idempotency
    // store: that store clears a failed run's key and expires at 30 days, so it
    // cannot be the authority on whether our work already started.
    //
    // The claim is NOT conditional on having read `queued` above. A sweeper
    // re-trigger typically starts long after the read, by which time the run
    // may have been claimed by another task or terminated by the sweeper's own
    // ceiling — and skipping the claim in that case would run a second paid
    // Parallel call and overwrite good output. Losing the update is the signal,
    // not the status we happened to observe.
    //
    // An escalation re-run is exempt: it is a deliberate re-entry that keeps the
    // run at its current status (pipeline-rules.md, Escalation), so it has no
    // claim to win and is never a duplicate.
    if (reason === "start") {
      // The handle travels with the status: `trigger_run_id` is what the
      // stalled sweeper asks Trigger.dev about (t-011-spec.md D1), and writing
      // it in the claim itself leaves no window where the row is working with
      // no task to name.
      //
      // A retry is a new attempt of the same Trigger.dev run, so the row it
      // claimed already carries its own id: `researching` + that id is this
      // run re-entering after a throw, not a duplicate, and must win again
      // (T-012). Any other run's id at `researching` still loses.
      const { data: claimed, error: claimError } = await service
        .from("analysis_runs")
        .update({ status: "researching", trigger_run_id: ctx.run.id })
        .eq("id", runId)
        .or(`status.eq.queued,and(status.eq.researching,trigger_run_id.eq.${ctx.run.id})`)
        .select("id")
        .maybeSingle<{ id: string }>();

      if (claimError) throw new Error(`run claim failed: ${claimError.message}`);

      if (!claimed) {
        // Another trigger got there first, or the run is no longer `queued` at
        // all. Returning rather than throwing: this is the guard working, not a
        // failure, and throwing would spend retries and end at onFailure marking
        // a healthy run failed.
        await agentLog(service, {
          runId,
          stage: STAGE,
          level: "warn",
          message: LOG_MESSAGES.alreadyClaimed,
          payload: { observed_status: run.status },
        });
        logger.log("stage 1 skipped, run already claimed", {
          runId,
          observedStatus: run.status,
        });
        return { runId, skipped: true as const };
      }
    }

    // Testing seam (t-012-spec.md): throw after the claim, so the retry must
    // re-win it. `always` throws on every attempt to reach onFailure.
    if (process.env.FORCE_STAGE1_RETRY) {
      if (process.env.FORCE_STAGE1_RETRY === "always" || ctx.attempt.number === 1) {
        throw new Error(`Forced stage 1 retry (FORCE_STAGE1_RETRY, attempt ${ctx.attempt.number})`);
      }
    }

    // Testing seam (t-011-spec.md D8): hold the run at `researching` long
    // enough to cancel it or kill the worker. A plain timer, not `wait.for`, so
    // Trigger.dev reports EXECUTING rather than WAITING.
    if (process.env.FORCE_STAGE1_HANG) {
      await sleepUntilAborted(HANG_MS, signal);
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
        // Logged before the wait, not after: the paid run exists from here,
        // and a task that dies mid-wait must still name it (T-013).
        onRunCreated: (parallelRunId) =>
          agentLog(service, {
            runId,
            stage: STAGE,
            message: LOG_MESSAGES.parallelCreated,
            payload: { parallel_run_id: parallelRunId, processor: run.processor },
          }),
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

    // Handoff to stage 2 (pipeline-rules.md: stages chain via triggerAndWait;
    // t-005-spec.md D1). The wait releases this run's per-user slot and does
    // not count toward maxDuration. A child failure is NOT a parent failure:
    // stage 2's own onFailure has already written `failed`, and throwing here
    // would retry this task — a second paid Parallel call to recover from a
    // model failure.
    let webKpiCount: number | null = null;

    if (!noData) {
      const extraction = await kpiExtractionTask.triggerAndWait(
        { runId },
        { region: "eu-central-1" },
      );

      if (extraction.ok) {
        webKpiCount = extraction.output.webKpiCount;

        // Stage 3, same contract as the stage-2 handoff: its own hooks write
        // the terminal, and a child failure never retries this task.
        const benchmarking = await peerBenchmarkingTask.triggerAndWait(
          { runId },
          { region: "eu-central-1" },
        );
        if (!benchmarking.ok) {
          await agentLog(service, {
            runId,
            stage: STAGE,
            level: "warn",
            message: LOG_MESSAGES.benchmarkingFailed,
            payload: { child_run_id: benchmarking.id, error: String(benchmarking.error) },
          });
        }
      } else {
        await agentLog(service, {
          runId,
          stage: STAGE,
          level: "warn",
          message: LOG_MESSAGES.extractionFailed,
          payload: { child_run_id: extraction.id, error: String(extraction.error) },
        });
      }
    }

    return {
      runId,
      source: research.source,
      noData,
      findings: research.output.findings.length,
      webKpiCount,
    };
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
