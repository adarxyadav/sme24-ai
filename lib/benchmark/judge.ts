import "server-only";
import { generateText, Output } from "ai";
import { pipelineModel } from "@/lib/extraction/extract";
import type { PeerFinding, ReferenceFinding } from "@/lib/parallel/peer-schema";
import type { KpiRow } from "@/lib/portal/kpis";
import { benchmarkJudgmentSchema, type BenchmarkJudgment } from "@/lib/benchmark/schema";

// Stage 3's judgment call (pipeline-rules.md, Stage 3: "Claude emits the
// judgment: maturity label + rationale, a one-to-two-sentence verdict, and the
// peer list"). Reached only from trigger/peer-benchmarking.ts. No arithmetic
// is asked of the model: rank and peer count come from lib/runs/rank.ts.

type JudgeInput = {
  companyName: string;
  sector: { nace_code: string | null; nace_label: string | null };
  kpis: Pick<KpiRow, "metric" | "value" | "unit" | "period" | "origin">[];
  peers: PeerFinding[];
  references: ReferenceFinding[];
  signal?: AbortSignal;
};

export type JudgeResult = {
  judgment: BenchmarkJudgment;
  model: string;
  usage: { inputTokens: number | undefined; outputTokens: number | undefined };
};

function buildPrompt(input: Omit<JudgeInput, "signal">): { system: string; prompt: string } {
  const system = [
    "You are a senior occupational health and safety consultant benchmarking one company against its sector peers.",
    "You are given the company's safety KPIs (as disclosed or supplied), an indexed list of peer companies with their disclosed injury rates, and any published sector reference rates.",
    "Rules:",
    "- rate_metric: TRIR if the company and at least one peer both have a TRIR on a per-1,000,000-hours basis; otherwise LTIFR on the same condition; otherwise null.",
    "- comparable_peer_indices: the peers with a real figure for rate_metric on a per-1,000,000-hours basis, in the same sector. Leave out peers on another basis (per 200,000 hours, per 100 employees, per 1,000 FTE) — a rate is never converted. Empty if rate_metric is null.",
    "- maturity_label: place the company on the Hudson safety-culture ladder — pathological (safety is a cost, no data), reactive (acts after incidents), calculative (systems and numbers in place), proactive (anticipates, workforce involved), generative (safety is how business is done). Judge from what the company discloses, how its rates compare, and the fatality record. Sparse disclosure with no figures at all is at most reactive.",
    "- maturity_rationale: two or three sentences that cite only figures present in the input.",
    "- verdict: one or two plain sentences a Swiss SME manager can read, stating how the company stands against its peers. Do not state a rank or a percentile — that is computed elsewhere. Do not invent numbers.",
  ].join("\n");

  const prompt = [
    `Company: ${input.companyName}`,
    `Sector: ${input.sector.nace_code ?? "unknown NACE"} ${input.sector.nace_label ?? ""}`.trim(),
    "",
    "Company KPIs (JSON, one per line):",
    ...(input.kpis.length ? input.kpis.map((row) => JSON.stringify(row)) : ["(none)"]),
    "",
    "Peers (JSON, one per line, indexed):",
    ...(input.peers.length
      ? input.peers.map((peer, index) =>
          JSON.stringify({
            index,
            company_name: peer.company_name,
            country: peer.country,
            trir: peer.trir,
            trir_basis: peer.trir_basis,
            ltifr: peer.ltifr,
            ltifr_basis: peer.ltifr_basis,
            reporting_year: peer.reporting_year,
            scope: peer.scope,
            confidence: peer.confidence,
          }),
        )
      : ["(none)"]),
    "",
    "Sector references (JSON, one per line):",
    ...(input.references.length ? input.references.map((ref) => JSON.stringify(ref)) : ["(none)"]),
  ].join("\n");

  return { system, prompt };
}

export async function judgeBenchmark(input: JudgeInput): Promise<JudgeResult> {
  const model = pipelineModel();
  const { system, prompt } = buildPrompt(input);

  const { output, usage } = await generateText({
    model,
    system,
    prompt,
    output: Output.object({ schema: benchmarkJudgmentSchema, name: "benchmark_judgment" }),
    // Trigger.dev owns retries (library-docs.md, Vercel AI SDK).
    maxRetries: 0,
    abortSignal: input.signal,
  });

  return {
    judgment: output,
    model,
    usage: { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens },
  };
}
