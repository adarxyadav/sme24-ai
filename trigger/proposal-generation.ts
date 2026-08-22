import { logger, task } from "@trigger.dev/sdk";
import { agentLog, LOG_MESSAGES } from "@/lib/runs/agent-log";
import { METRIC_LABELS, type CanonicalMetric } from "@/lib/runs/metrics";
import type { ResearchEnvelope } from "@/lib/runs/research";
import { draftProposal } from "@/lib/proposal/draft";
import { renderProposalPdf } from "@/lib/proposal/pdf";
import { retrievePassages } from "@/lib/vault/retrieve";
import { createServiceClient } from "@/lib/supabase/service";

// Stage 5 — proposal generation (pipeline-rules.md, Stages; t-019-spec.md).
// Triggered by stage 1 via triggerAndWait after matching. Vault retrieval,
// one model call, a PDF rendered in code and uploaded to the private bucket.
// Owns the last two moves of the machine: matching -> generating -> completed.

const STAGE = "proposal";
const BUCKET = "proposals";

const TASK_MAX_DURATION_SECONDS = 600;

type Payload = { runId: string };

type RunRow = { id: string; company_name: string; research: ResearchEnvelope | null };
type KpiRow = { metric: CanonicalMetric; value: string | null; unit: string | null; period: string | null; origin: string };
type BenchmarkRow = { maturity_label: string | null; verdict: string | null; rank: number | null; peer_count: number };
type MatchRow = { rank: number; rationale: string; experts: { full_name: string; headline: string } | null };

const numberFormat = new Intl.NumberFormat("de-CH", { maximumFractionDigits: 2 });

export const proposalGenerationTask = task({
  id: "proposal-generation",
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
      .update({ status: "generating", trigger_run_id: ctx.run.id })
      .eq("id", runId)
      .in("status", ["matching", "generating"])
      .select("id, company_name, research")
      .maybeSingle<RunRow>();

    if (claimError) throw new Error(`status update failed: ${claimError.message}`);
    if (!claimed) throw new Error(`run ${runId} is not awaiting proposal generation`);
    if (!claimed.research) throw new Error(`run ${runId} has no research to draft from`);

    const [kpisRes, benchRes, matchRes] = await Promise.all([
      service.from("kpis").select("metric, value, unit, period, origin").eq("run_id", runId).returns<KpiRow[]>(),
      service.from("benchmarks").select("maturity_label, verdict, rank, peer_count").eq("run_id", runId).maybeSingle<BenchmarkRow>(),
      service.from("expert_matches").select("rank, rationale, experts(full_name, headline)").eq("run_id", runId).order("rank").returns<MatchRow[]>(),
    ]);
    if (kpisRes.error) throw new Error(`kpi read failed: ${kpisRes.error.message}`);
    if (benchRes.error) throw new Error(`benchmark read failed: ${benchRes.error.message}`);
    if (matchRes.error) throw new Error(`match read failed: ${matchRes.error.message}`);

    const kpis = (kpisRes.data ?? []).map((row) => ({ ...row, value: row.value === null ? null : Number(row.value) }));
    const { sector, company } = claimed.research.output;
    const experts = (matchRes.data ?? []).flatMap((m) =>
      m.experts ? [{ rank: m.rank, full_name: m.experts.full_name, headline: m.experts.headline, rationale: m.rationale }] : [],
    );

    await agentLog(service, {
      runId,
      stage: STAGE,
      message: LOG_MESSAGES.proposalStarted,
      payload: { attempt: ctx.attempt.number, kpis: kpis.length, experts: experts.length },
    });

    // Retrieval query: what the analysis knows about this company, in words.
    const query = [
      `EHS consulting for a ${sector.nace_label ?? "company"} (NACE ${sector.nace_code ?? "unknown"}) in ${company.country ?? "Switzerland"}`,
      ...kpis.map((k) => `${METRIC_LABELS[k.metric]} ${k.value ?? "not disclosed"} ${k.unit ?? ""}`),
      benchRes.data?.verdict ?? "",
    ].join(". ");
    const passages = await retrievePassages(service, query, signal);

    await agentLog(service, {
      runId,
      stage: STAGE,
      message: LOG_MESSAGES.vaultRetrieved,
      payload: { passages: passages.map((p) => ({ id: p.id, title: p.title, similarity: p.similarity })) },
    });

    const draft = await draftProposal({
      companyName: claimed.company_name,
      country: company.country,
      sector,
      headcount: company.headcount,
      kpis,
      benchmark: benchRes.data ?? null,
      experts,
      passages,
      signal,
    });

    // Only passages the model relied on are recorded as sources; an index
    // outside the retrieved set is dropped, never invented.
    const sources = [...new Set(draft.content.passage_indices)]
      .flatMap((index) => (passages[index] ? [passages[index]] : []))
      .map((p) => ({ id: p.id, title: p.title, source: p.source, similarity: p.similarity }));

    const pdf = await renderProposalPdf({
      companyName: claimed.company_name,
      generatedOn: new Intl.DateTimeFormat("de-CH", { dateStyle: "long" }).format(new Date()),
      content: draft.content,
      kpis: kpis
        .filter((k) => k.value !== null)
        .map((k) => ({
          label: METRIC_LABELS[k.metric],
          value: numberFormat.format(k.value as number),
          unit: k.unit,
          period: k.period,
          origin: k.origin,
        })),
      sources: sources.map((s) => ({ title: s.title, source: s.source })),
    });

    const pdfPath = `${runId}/proposal.pdf`;
    const { error: uploadError } = await service.storage
      .from(BUCKET)
      .upload(pdfPath, pdf, { contentType: "application/pdf", upsert: true });
    if (uploadError) throw new Error(`pdf upload failed: ${uploadError.message}`);

    const { error: upsertError } = await service.from("proposals").upsert(
      { run_id: runId, content: draft.content, pdf_path: pdfPath, sources, model: draft.model },
      { onConflict: "run_id" },
    );
    if (upsertError) throw new Error(`proposal write failed: ${upsertError.message}`);

    await agentLog(service, {
      runId,
      stage: STAGE,
      message: LOG_MESSAGES.proposalStored,
      payload: {
        pdf_path: pdfPath,
        pdf_bytes: pdf.byteLength,
        recommended_tier: draft.content.recommended_tier,
        sources: sources.length,
        model: draft.model,
        usage: draft.usage,
      },
    });

    const { data: completed, error: completeError } = await service
      .from("analysis_runs")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", runId)
      .eq("status", "generating")
      .select("id")
      .maybeSingle<{ id: string }>();

    if (completeError) throw new Error(`completion write failed: ${completeError.message}`);
    if (!completed) throw new Error(`run ${runId} left generating before completion`);

    await agentLog(service, { runId, stage: STAGE, message: LOG_MESSAGES.runCompleted, payload: { pdf_path: pdfPath } });
    logger.log("stage 5 complete", { runId, pdfPath, sources: sources.length });

    return { runId, pdfPath, sources: sources.length };
  },

  onCancel: async ({ payload }) => {
    const { runId } = payload as Payload;
    const service = createServiceClient();

    const { error: statusError } = await service
      .from("analysis_runs")
      .update({ status: "failed", error: "Run cancelled before stage 5 completed", completed_at: new Date().toISOString() })
      .eq("id", runId)
      .eq("status", "generating");

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
