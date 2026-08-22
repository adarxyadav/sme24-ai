import "server-only";
import { generateText, Output } from "ai";
import { pipelineModel } from "@/lib/extraction/extract";
import { TIERS } from "@/lib/packages/tiers";
import type { VaultPassage } from "@/lib/vault/retrieve";
import { proposalSchema, type ProposalContent } from "@/lib/proposal/schema";

// Stage 5's one model call (pipeline-rules.md, Stage 5). Reached only from
// trigger/proposal-generation.ts. Numbers in the proposal come from the input
// rows; the model is told so, and the PDF renders the ledger from the rows,
// not from the prose.

export type DraftInput = {
  companyName: string;
  country: string | null;
  sector: { nace_code: string | null; nace_label: string | null };
  headcount: number | null;
  kpis: Array<{ metric: string; value: number | null; unit: string | null; period: string | null; origin: string }>;
  benchmark: { maturity_label: string | null; verdict: string | null; rank: number | null; peer_count: number } | null;
  experts: Array<{ rank: number; full_name: string; headline: string; rationale: string }>;
  passages: VaultPassage[];
  signal?: AbortSignal;
};

export type DraftResult = {
  content: ProposalContent;
  model: string;
  usage: { inputTokens: number | undefined; outputTokens: number | undefined };
};

function buildPrompt(input: Omit<DraftInput, "signal">): { system: string; prompt: string } {
  const system = [
    "You write the consulting proposal that follows a free EHS (occupational health and safety) analysis for a Swiss company. The reader is the company's managing director.",
    "Write in plain, direct English; short paragraphs; no marketing fluff. Swiss context: SUVA, EKAS, the Labour Act and ISO 45001 are the frame.",
    "Rules:",
    "- Use only the facts in the input. Never invent a figure, a law, a certification or a fact about the company or an expert. If something is unknown, say so or leave it out.",
    "- situation: 3–6 bullets restating what the analysis found (disclosed KPIs, benchmark position, data gaps).",
    "- key_risks: the risks the findings imply, each with why it matters to this company.",
    "- recommended_tier: exactly one package id from the list, chosen by the depth the situation needs; recommendation_rationale explains the choice against the other tiers in two or three sentences.",
    "- roadmap: 2–4 phases with concrete actions.",
    "- experts_note: one paragraph on who from our network would lead the work, using the matched experts by name; if none were matched, say the engagement would be staffed on request.",
    "- Reference passages: when a passage from our reference library supports a statement, rely on it and list its index in passage_indices. Do not quote passages verbatim at length; never cite an index that is not in the input.",
  ].join("\n");

  const prompt = [
    `Company: ${input.companyName}${input.country ? ` (${input.country})` : ""}`,
    `Sector: ${input.sector.nace_code ?? "unknown NACE"} ${input.sector.nace_label ?? ""}`.trim(),
    `Headcount: ${input.headcount ?? "unknown"}`,
    "",
    "KPIs (JSON, one per line):",
    ...(input.kpis.length ? input.kpis.map((row) => JSON.stringify(row)) : ["(none)"]),
    "",
    `Benchmark: ${input.benchmark ? JSON.stringify(input.benchmark) : "(insufficient data)"}`,
    "",
    "Matched experts (JSON, one per line):",
    ...(input.experts.length ? input.experts.map((e) => JSON.stringify(e)) : ["(none)"]),
    "",
    "Packages (JSON, one per line):",
    ...TIERS.map((t) =>
      JSON.stringify({ id: t.id, name: t.name, format: t.format, scope: t.scope, output: t.output, price_chf: t.priceChf ?? "on request" }),
    ),
    "",
    "Reference passages (indexed):",
    ...(input.passages.length
      ? input.passages.map((p, index) => `[${index}] ${p.title}${p.source ? ` (${p.source})` : ""}\n${p.content}`)
      : ["(none — draft without references)"]),
  ].join("\n");

  return { system, prompt };
}

export async function draftProposal(input: DraftInput): Promise<DraftResult> {
  const model = pipelineModel();
  const { system, prompt } = buildPrompt(input);

  const { output, usage } = await generateText({
    model,
    system,
    prompt,
    output: Output.object({ schema: proposalSchema, name: "proposal" }),
    maxRetries: 0,
    abortSignal: input.signal,
  });

  return {
    content: output,
    model,
    usage: { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens },
  };
}
