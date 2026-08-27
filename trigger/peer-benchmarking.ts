import { logger, task } from "@trigger.dev/sdk";
import { agentLog, LOG_MESSAGES } from "@/lib/runs/agent-log";
import { judgeBenchmark } from "@/lib/benchmark/judge";
import { benchmarkPeers } from "@/lib/parallel/client";
import type { PeerFinding, ReferenceFinding } from "@/lib/parallel/peer-schema";
import type { ResearchEnvelope } from "@/lib/runs/research";
import { RATE_METRICS, type CanonicalMetric } from "@/lib/runs/metrics";
import {
  deriveRank,
  isPerMillionHours,
  type BenchmarkComparison,
  type BenchmarkPeer,
  type BenchmarkReference,
  type RateMetric,
} from "@/lib/runs/rank";
import { createServiceClient } from "@/lib/supabase/service";

// Stage 3 — peer benchmarking (pipeline-rules.md, Stages; t-016-spec.md).
// Triggered by stage 1 via triggerAndWait after extraction. Parallel gathers
// the peers (base processor, never cached), the model judges, code derives
// every number. Moves the machine one step, extracting -> benchmarking; stage 4
// claims the run from `benchmarking`.

const STAGE = "benchmark";

const TASK_MAX_DURATION_SECONDS = 1200;
const PARALLEL_MAX_WAIT_SECONDS = 900;

type Payload = { runId: string };

type RunRow = {
  id: string;
  company_name: string;
  research: ResearchEnvelope | null;
};

type KpiRow = {
  metric: CanonicalMetric;
  value: string | null;
  unit: string | null;
  period: string | null;
  origin: "web" | "upload" | "client";
};

function isRateMetric(metric: CanonicalMetric): metric is RateMetric {
  return (RATE_METRICS as readonly string[]).includes(metric);
}

// Comparability rules (pipeline-rules.md, Stage 3): references are set only on
// rate_metric's metric and base. The first reference on that metric with a
// per-million-hours basis wins; anything else is dropped, not converted.
function pickReference(
  references: ReferenceFinding[],
  rateMetric: RateMetric | null,
): BenchmarkReference | null {
  if (!rateMetric) return null;
  const match = references.find(
    (ref) => ref.metric === rateMetric && isPerMillionHours(ref.basis),
  );
  if (!match) return null;
  return {
    metric: match.metric,
    basis: match.basis,
    median: match.median,
    best_in_class: match.best_in_class,
    source_url: match.source_url,
    source_excerpt: match.source_excerpt,
  };
}

export const peerBenchmarkingTask = task({
  id: "peer-benchmarking",
  maxDuration: TASK_MAX_DURATION_SECONDS,
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 60_000,
    maxTimeoutInMs: 300_000,
    factor: 2,
    randomize: true,
  },

  run: async ({ runId }: Payload, { ctx, signal }) => {
    const service = createServiceClient();

    // `benchmarking` included so a retried attempt is idempotent; zero rows
    // means the run is elsewhere in the machine and nothing may be written.
    const { data: claimed, error: claimError } = await service
      .from("analysis_runs")
      .update({ status: "benchmarking", trigger_run_id: ctx.run.id })
      .eq("id", runId)
      .in("status", ["extracting", "benchmarking"])
      .select("id, company_name, research")
      .maybeSingle<RunRow>();

    if (claimError) throw new Error(`status update failed: ${claimError.message}`);
    if (!claimed) throw new Error(`run ${runId} is not awaiting benchmarking`);
    if (!claimed.research) throw new Error(`run ${runId} has no research to benchmark from`);

    const { data: kpis, error: kpiError } = await service
      .from("kpis")
      .select("metric, value, unit, period, origin")
      .eq("run_id", runId)
      .returns<KpiRow[]>();

    if (kpiError) throw new Error(`kpi read failed: ${kpiError.message}`);

    const rows = (kpis ?? []).map((row) => ({
      ...row,
      value: row.value === null ? null : Number(row.value),
    }));

    const { sector, company } = claimed.research.output;

    await agentLog(service, {
      runId,
      stage: STAGE,
      message: LOG_MESSAGES.benchmarkingStarted,
      payload: { attempt: ctx.attempt.number, sector: sector.nace_code, kpis: rows.length },
    });

    let peers: PeerFinding[] = [];
    let references: ReferenceFinding[] = [];
    let parallelRunId: string | null = null;
    let industryNotes: string | null = null;

    // Testing seam (t-016-spec.md D5): the insufficient-data path without a
    // paid call.
    if (!process.env.FORCE_STAGE3_EMPTY) {
      // Peer research is never cached (pipeline-rules.md, Caching) and runs on
      // the base processor by default (Escalation).
      const result = await benchmarkPeers({
        companyName: claimed.company_name,
        naceCode: sector.nace_code,
        naceLabel: sector.nace_label,
        country: company.country,
        headcount: company.headcount,
        processor: "base",
        maxWaitSeconds: PARALLEL_MAX_WAIT_SECONDS,
        signal,
        onRunCreated: (id) =>
          agentLog(service, {
            runId,
            stage: STAGE,
            message: LOG_MESSAGES.parallelCreated,
            payload: { parallel_run_id: id, processor: "base" },
          }),
      });
      peers = result.output.peers;
      references = result.output.references;
      parallelRunId = result.parallelRunId;
      industryNotes = result.output.industry.notes;
    }

    // A reference on another base can never be shown (comparability rules),
    // so the judge never sees it either — a rationale must not cite a figure
    // the card cannot display.
    const comparableReferences = references.filter((ref) => isPerMillionHours(ref.basis));

    await agentLog(service, {
      runId,
      stage: STAGE,
      message: LOG_MESSAGES.peersGathered,
      payload: {
        peers: peers.length,
        references: references.length,
        references_on_base: comparableReferences.length,
        dropped_references: references
          .filter((ref) => !isPerMillionHours(ref.basis))
          .map((ref) => ({ metric: ref.metric, basis: ref.basis })),
        parallel_run_id: parallelRunId,
      },
    });

    // Neither peers nor references: the benchmark states insufficient data and
    // the run continues (pipeline-rules.md, Stage 3). No model call — there is
    // nothing to judge.
    const judged =
      peers.length === 0 && comparableReferences.length === 0
        ? null
        : await judgeBenchmark({
            companyName: claimed.company_name,
            sector,
            kpis: rows.map(({ metric, value, unit, period, origin }) => ({ metric, value, unit, period, origin })),
            peers,
            references: comparableReferences,
            signal,
          });

    const rateMetric = judged?.judgment.rate_metric ?? null;
    const comparable = new Set(judged?.judgment.comparable_peer_indices ?? []);

    const companyRates: BenchmarkComparison["company"] = { TRIR: null, LTIFR: null };
    for (const row of rows) {
      if (isRateMetric(row.metric) && row.value !== null) {
        companyRates[row.metric] = { value: row.value, unit: row.unit };
      }
    }

    const storedPeers: BenchmarkPeer[] = peers.map((peer, index) => ({
      company_name: peer.company_name,
      country: peer.country,
      trir: peer.trir,
      trir_basis: peer.trir_basis,
      ltifr: peer.ltifr,
      ltifr_basis: peer.ltifr_basis,
      reporting_year: peer.reporting_year,
      scope: peer.scope,
      source_url: peer.source_url,
      source_excerpt: peer.source_excerpt,
      confidence: peer.confidence,
      comparable: comparable.has(index),
    }));

    const comparison: BenchmarkComparison = {
      schema_version: 1,
      rate_metric: rateMetric,
      company: companyRates,
      peers: storedPeers,
      references: pickReference(comparableReferences, rateMetric),
      industry: { nace_code: sector.nace_code, nace_label: sector.nace_label, notes: industryNotes },
    };

    // The arithmetic, in code (lib/runs/rank.ts) — the read layer runs the
    // same function over the same stored peers.
    const { rank, peerCount } = deriveRank(comparison);

    const { error: upsertError } = await service.from("benchmarks").upsert(
      {
        run_id: runId,
        rate_metric: rateMetric,
        peer_count: peerCount,
        rank,
        verdict: judged?.judgment.verdict ?? null,
        maturity_label: judged?.judgment.maturity_label ?? null,
        maturity_rationale: judged?.judgment.maturity_rationale ?? null,
        per_metric_comparison: comparison,
        parallel_run_id: parallelRunId,
      },
      { onConflict: "run_id" },
    );

    if (upsertError) throw new Error(`benchmark write failed: ${upsertError.message}`);

    await agentLog(service, {
      runId,
      stage: STAGE,
      message: LOG_MESSAGES.benchmarkStored,
      payload: {
        rate_metric: rateMetric,
        rank,
        peer_count: peerCount,
        maturity_label: judged?.judgment.maturity_label ?? null,
        model: judged?.model ?? null,
        usage: judged?.usage ?? null,
      },
    });

    // The run stays `benchmarking` for stage 4 to claim; the handle goes back
    // to the waiting parent first, for the same reason as in stage 2
    // (t-018-spec.md D4).
    const { error: handBackError } = await service
      .from("analysis_runs")
      .update({ trigger_run_id: ctx.run.parentTaskRunId ?? ctx.run.id })
      .eq("id", runId)
      .eq("status", "benchmarking")
      .eq("trigger_run_id", ctx.run.id);

    if (handBackError) throw new Error(`handle hand-back failed: ${handBackError.message}`);
    logger.log("stage 3 complete", { runId, rateMetric, rank, peerCount });

    return { runId, rateMetric, rank, peerCount };
  },

  onCancel: async ({ payload }) => {
    const { runId } = payload as Payload;
    const service = createServiceClient();

    const { error: statusError } = await service
      .from("analysis_runs")
      .update({
        status: "failed",
        error: "Run cancelled before stage 3 completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", runId)
      .eq("status", "benchmarking");

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
