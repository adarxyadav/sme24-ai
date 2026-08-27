import { logger, task } from "@trigger.dev/sdk";
import { agentLog, LOG_MESSAGES } from "@/lib/runs/agent-log";
import type { ExpertRow } from "@/lib/experts/read";
import { matchExperts } from "@/lib/matching/judge";
import type { ResearchEnvelope } from "@/lib/runs/research";
import { createServiceClient } from "@/lib/supabase/service";

// Stage 4 — expert matchmaking (pipeline-rules.md, Stages; t-018-spec.md).
// Triggered by stage 1 via triggerAndWait after benchmarking. One model call
// over the approved experts; code validates and writes the top 3 in one
// transaction. Moves the machine one step, benchmarking -> matching; stage 5
// claims the run from `matching`.

const STAGE = "matching";

const TASK_MAX_DURATION_SECONDS = 600;

type Payload = { runId: string };

type RunRow = { id: string; company_name: string; research: ResearchEnvelope | null };

type KpiRow = { metric: string; value: string | null; unit: string | null; period: string | null; origin: string };

type BenchmarkRow = { maturity_label: string | null; verdict: string | null };

// experts joined to profiles through user_id: only approved experts are
// candidates (auth.md — grants key on approval, not intent).
type CandidateRow = ExpertRow & { id: string; user_id: string };

export const expertMatchingTask = task({
  id: "expert-matching",
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

    const { data: claimed, error: claimError } = await service
      .from("analysis_runs")
      .update({ status: "matching", trigger_run_id: ctx.run.id })
      .eq("id", runId)
      .in("status", ["benchmarking", "matching"])
      .select("id, company_name, research")
      .maybeSingle<RunRow>();

    if (claimError) throw new Error(`status update failed: ${claimError.message}`);
    if (!claimed) throw new Error(`run ${runId} is not awaiting matching`);
    if (!claimed.research) throw new Error(`run ${runId} has no research to match from`);

    const [{ data: kpis, error: kpiError }, { data: benchmark, error: benchError }] =
      await Promise.all([
        service.from("kpis").select("metric, value, unit, period, origin").eq("run_id", runId).returns<KpiRow[]>(),
        service.from("benchmarks").select("maturity_label, verdict").eq("run_id", runId).maybeSingle<BenchmarkRow>(),
      ]);
    if (kpiError) throw new Error(`kpi read failed: ${kpiError.message}`);
    if (benchError) throw new Error(`benchmark read failed: ${benchError.message}`);

    // Approved experts only: profiles is the authority on approval.
    const { data: approved, error: profileError } = await service
      .from("profiles")
      .select("id")
      .eq("role", "expert")
      .eq("expert_status", "approved")
      .returns<{ id: string }[]>();
    if (profileError) throw new Error(`profiles read failed: ${profileError.message}`);

    const approvedIds = (approved ?? []).map((row) => row.id);
    const { data: candidates, error: expertError } = approvedIds.length
      ? await service
          .from("experts")
          .select("id, user_id, full_name, headline, bio, competencies, sectors, languages, regions, years_experience, availability, updated_at")
          .in("user_id", approvedIds)
          .returns<CandidateRow[]>()
      : { data: [] as CandidateRow[], error: null };
    if (expertError) throw new Error(`experts read failed: ${expertError.message}`);

    const pool = candidates ?? [];
    const { sector, company } = claimed.research.output;

    await agentLog(service, {
      runId,
      stage: STAGE,
      message: LOG_MESSAGES.matchingStarted,
      payload: { attempt: ctx.attempt.number, candidates: pool.length, sector: sector.nace_code },
    });

    let written = 0;
    let matchedIds: string[] = [];
    let model: string | null = null;
    let usage: { inputTokens: number | undefined; outputTokens: number | undefined } | null = null;
    let riskSummary: string | null = null;

    // No candidates: nothing to judge, zero rows, the run continues.
    if (pool.length > 0) {
      const result = await matchExperts({
        companyName: claimed.company_name,
        sector,
        country: company.country,
        kpis: (kpis ?? []).map((row) => ({ ...row, value: row.value === null ? null : Number(row.value) })),
        benchmark: benchmark ?? null,
        experts: pool,
        signal,
      });
      model = result.model;
      usage = result.usage;
      riskSummary = result.matching.risk_profile.summary;

      // Code validates what the model named: a bad or repeated index throws
      // rather than writing a wrong expert under a client's report.
      const seen = new Set<number>();
      const rows = result.matching.matches.map((match, position) => {
        const expert = pool[match.expert_index];
        if (!expert) throw new Error(`expert index out of range: ${match.expert_index}`);
        if (seen.has(match.expert_index)) throw new Error(`duplicate expert in matching: ${match.expert_index}`);
        seen.add(match.expert_index);
        return { expert_id: expert.id, rank: position + 1, score: match.score, rationale: match.rationale };
      });

      const { data: inserted, error: swapError } = await service.rpc("replace_expert_matches", {
        p_run_id: runId,
        p_matches: rows,
      });
      if (swapError) throw new Error(`match write failed: ${swapError.message}`);
      written = typeof inserted === "number" ? inserted : rows.length;
      matchedIds = rows.map((row) => row.expert_id);
    } else {
      const { error: clearError } = await service.rpc("replace_expert_matches", { p_run_id: runId, p_matches: [] });
      if (clearError) throw new Error(`match clear failed: ${clearError.message}`);
    }

    await agentLog(service, {
      runId,
      stage: STAGE,
      message: LOG_MESSAGES.matchesStored,
      payload: { written, expert_ids: matchedIds, model, usage, risk_summary: riskSummary },
    });

    // The run stays `matching` for stage 5 to claim; the handle goes back to
    // the waiting parent first (t-018-spec.md D4).
    const { error: handBackError } = await service
      .from("analysis_runs")
      .update({ trigger_run_id: ctx.run.parentTaskRunId ?? ctx.run.id })
      .eq("id", runId)
      .eq("status", "matching")
      .eq("trigger_run_id", ctx.run.id);

    if (handBackError) throw new Error(`handle hand-back failed: ${handBackError.message}`);

    logger.log("stage 4 complete", { runId, matches: written });

    return { runId, matches: written };
  },

  onCancel: async ({ payload }) => {
    const { runId } = payload as Payload;
    const service = createServiceClient();

    const { error: statusError } = await service
      .from("analysis_runs")
      .update({
        status: "failed",
        error: "Run cancelled before stage 4 completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", runId)
      .eq("status", "matching");

    if (statusError) {
      logger.error("failed to mark cancelled run", { runId, message: statusError.message });
    }

    await agentLog(service, { runId, stage: STAGE, level: "warn", message: LOG_MESSAGES.cancelled, payload: {} });
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
