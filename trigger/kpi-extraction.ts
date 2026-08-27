import { logger, task } from "@trigger.dev/sdk";
import { agentLog, LOG_MESSAGES } from "@/lib/runs/agent-log";
import { mapFindings, projectRows } from "@/lib/extraction/extract";
import type { ResearchEnvelope } from "@/lib/runs/research";
import type { CanonicalMetric } from "@/lib/runs/metrics";
import { createServiceClient } from "@/lib/supabase/service";

// Stage 2 — KPI extraction (pipeline-rules.md, Stages; t-005-spec.md).
// Triggered by stage 1 via triggerAndWait once `research` is written. Reads
// the research and the client rows from the run itself — never from a cache
// donor — and writes the web rows in one atomic swap that cannot touch a
// client row. Owns the last two moves of the state machine for now:
// researching -> extracting -> completed.

const STAGE = "extraction";

// One model call on a few KB of findings; generous, and far below stage 1's.
const TASK_MAX_DURATION_SECONDS = 600;

type Payload = { runId: string };

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

type RunRow = {
  id: string;
  company_name: string;
  research: ResearchEnvelope | null;
};

type ClientKpiRow = { metric: CanonicalMetric; period: string | null };

export const kpiExtractionTask = task({
  id: "kpi-extraction",
  maxDuration: TASK_MAX_DURATION_SECONDS,
  retry: {
    maxAttempts: 3,
    // pipeline-rules.md, Escalation: model-call retry backoff >= 60s.
    minTimeoutInMs: 60_000,
    maxTimeoutInMs: 300_000,
    factor: 2,
    randomize: true,
  },

  run: async ({ runId }: Payload, { ctx, signal }) => {
    const service = createServiceClient();

    // `extracting` is included so a retried attempt is idempotent here. Zero
    // rows means the run is terminal or elsewhere in the machine, and writing
    // KPIs onto it would be wrong — so this throws rather than proceeds.
    const { data: claimed, error: claimError } = await service
      .from("analysis_runs")
      // The child overwrites the parent's handle: at `extracting` the child is
      // the task whose liveness decides the row (t-011-spec.md D3).
      .update({ status: "extracting", trigger_run_id: ctx.run.id })
      .eq("id", runId)
      .in("status", ["researching", "extracting"])
      .select("id, company_name, research")
      .maybeSingle<RunRow>();

    if (claimError) throw new Error(`status update failed: ${claimError.message}`);
    if (!claimed) throw new Error(`run ${runId} is not awaiting extraction`);
    if (!claimed.research) throw new Error(`run ${runId} has no research to extract from`);

    // Testing seam (t-011-spec.md D8): hold the parent inside triggerAndWait
    // (WAITING) with this child EXECUTING, so a live sweep sees both.
    if (process.env.FORCE_STAGE2_HANG) {
      await sleepUntilAborted(HANG_MS, signal);
    }

    const { data: clientKpis, error: kpiError } = await service
      .from("kpis")
      .select("metric, period")
      .eq("run_id", runId)
      .eq("origin", "client")
      .returns<ClientKpiRow[]>();

    if (kpiError) throw new Error(`client kpi read failed: ${kpiError.message}`);

    const clientMetrics = (clientKpis ?? []).map((row) => row.metric);
    // The form sends one reporting period for every client row (t-003), so the
    // first non-null value is the client's period.
    const clientPeriod = (clientKpis ?? []).find((row) => row.period)?.period ?? null;
    const findings = claimed.research.output.findings;

    await agentLog(service, {
      runId,
      stage: STAGE,
      message: LOG_MESSAGES.extractionStarted,
      payload: {
        attempt: ctx.attempt.number,
        findings: findings.length,
        research_source: claimed.research.source,
        client_metrics: clientMetrics,
      },
    });

    const mapped = await mapFindings({
      companyName: claimed.company_name,
      findings,
      clientMetrics,
      clientPeriod,
      signal,
    });

    // Testing seam (t-005-spec.md D8, seam 3). The model's schema already
    // forbids a non-canonical metric, so the only way to exercise the gate in
    // projectRows is to bypass the schema and inject one after the call.
    const mappings: Array<{ metric: string; finding_index: number; rationale: string }> = [
      ...mapped.mappings,
    ];
    if (process.env.FORCE_STAGE2_BAD_METRIC) {
      mappings.push({ metric: "headcount", finding_index: 0, rationale: "FORCE_STAGE2_BAD_METRIC" });
    }

    const projected = projectRows({ findings, mappings });

    // Client rows win (t-005-spec.md D4). The function's anti-join enforces it
    // regardless; dropping here keeps the normal path off the constraint and
    // makes the conflict visible in the log.
    const dropped = projected.filter((row) => clientMetrics.includes(row.metric));
    const rows = projected.filter((row) => !clientMetrics.includes(row.metric));

    const { data: inserted, error: swapError } = await service.rpc("replace_extracted_kpis", {
      p_run_id: runId,
      p_kpis: rows,
    });

    if (swapError) throw new Error(`kpi swap failed: ${swapError.message}`);

    await agentLog(service, {
      runId,
      stage: STAGE,
      message: LOG_MESSAGES.kpisExtracted,
      payload: {
        attempt: ctx.attempt.number,
        model: mapped.model,
        usage: mapped.usage,
        mapped: mapped.mappings,
        written: typeof inserted === "number" ? inserted : null,
        dropped_for_client: dropped.map((row) => row.metric),
      },
    });

    // Testing seam (t-005-spec.md D8, seam 2): attempt 1 fails after the swap
    // has committed, so attempt 2 replays it over existing rows.
    if (process.env.FORCE_STAGE2_RETRY && ctx.attempt.number === 1) {
      throw new Error("Forced stage 2 retry (FORCE_STAGE2_RETRY)");
    }

    // From `extracting` only: the machine moves forward, and a cancellation
    // or failure that already terminated the run must not be overwritten.
    const { data: completed, error: completeError } = await service
      .from("analysis_runs")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", runId)
      .eq("status", "extracting")
      .select("id")
      .maybeSingle<{ id: string }>();

    if (completeError) throw new Error(`completion write failed: ${completeError.message}`);
    if (!completed) throw new Error(`run ${runId} left extracting before completion`);

    await agentLog(service, {
      runId,
      stage: STAGE,
      message: LOG_MESSAGES.runCompleted,
      payload: { web_kpis: rows.length },
    });

    logger.log("stage 2 complete", { runId, webKpis: rows.length });

    // The waiting parent reads this; the deferred base -> ultra escalation
    // (t-005-spec.md D7) is one `if` on webKpiCount when it lands.
    return { runId, webKpiCount: rows.length };
  },

  // Cancellation does not reach onFailure (SDK docs). From `extracting` only:
  // a cancellation racing the `completed` write must not undo it.
  onCancel: async ({ payload }) => {
    const { runId } = payload as Payload;
    const service = createServiceClient();

    const { error: statusError } = await service
      .from("analysis_runs")
      .update({
        status: "failed",
        error: "Run cancelled before stage 2 completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", runId)
      .eq("status", "extracting");

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
  // (pipeline-rules.md). Same shape as stage 1's hook.
  onFailure: async ({ payload, error }) => {
    const { runId } = payload as Payload;
    const service = createServiceClient();

    const cause = error instanceof Error ? error : new Error(String(error));
    const summary = `${cause.name}: ${cause.message}`.slice(0, 500);

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
