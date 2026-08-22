import "server-only";
import { generateText, Output } from "ai";
import { pipelineModel } from "@/lib/extraction/extract";
import { COMPETENCIES, LANGUAGES, NACE_SECTIONS, REGIONS, AVAILABILITY } from "@/lib/experts/catalogue";
import type { ExpertRow } from "@/lib/experts/read";
import { matchingSchema, type Matching } from "@/lib/matching/schema";

// Stage 4's one model call (pipeline-rules.md, Stage 4: "risk -> competency
// tags -> score & rank approved experts. Top-3"). Reached only from
// trigger/expert-matching.ts. The rationale doubles as client-facing copy
// (Decision log, AI expert ranking), so the prompt asks for it in that voice.

type Candidate = Pick<
  ExpertRow,
  "full_name" | "headline" | "bio" | "competencies" | "sectors" | "languages" | "regions" | "years_experience" | "availability"
>;

type JudgeInput = {
  companyName: string;
  sector: { nace_code: string | null; nace_label: string | null };
  country: string | null;
  kpis: Array<{ metric: string; value: number | null; unit: string | null; period: string | null; origin: string }>;
  benchmark: { maturity_label: string | null; verdict: string | null } | null;
  experts: Candidate[];
  signal?: AbortSignal;
};

export type MatchResult = {
  matching: Matching;
  model: string;
  usage: { inputTokens: number | undefined; outputTokens: number | undefined };
};

function buildPrompt(input: Omit<JudgeInput, "signal">): { system: string; prompt: string } {
  const system = [
    "You match a company to the senior EHS consultants best placed to improve its safety performance.",
    "First derive the company's risk profile from its sector, its KPIs and its benchmark: two or three sentences, plus the competency tags (from the catalogue) the next engagement needs most.",
    "Then score each candidate expert from 0 to 100 for fit and return the top three, best first, each with a rationale.",
    "Rules:",
    "- Fit is competency overlap with the needed tags first, then sector familiarity, then language and region, then availability. Years of experience break ties.",
    "- Return at most three matches, all distinct indices, and only candidates from the list. Fewer than three is correct when fewer fit at all; an empty list is correct when no candidate fits.",
    "- rationale: one or two sentences written to the company, in plain language, saying why this expert fits their situation. Name the expert's relevant competencies; never state the score, never invent facts about the expert, never cite a KPI value not in the input.",
    `Competency catalogue (use the key in competencies_needed, the label in prose): ${Object.entries(COMPETENCIES).map(([k, v]) => `${k} = ${v}`).join("; ")}`,
  ].join("\n");

  const prompt = [
    `Company: ${input.companyName}${input.country ? ` (${input.country})` : ""}`,
    `Sector: ${input.sector.nace_code ?? "unknown NACE"} ${input.sector.nace_label ?? ""}`.trim(),
    "",
    "Company KPIs (JSON, one per line):",
    ...(input.kpis.length ? input.kpis.map((row) => JSON.stringify(row)) : ["(none)"]),
    "",
    `Benchmark: ${input.benchmark ? JSON.stringify(input.benchmark) : "(none)"}`,
    "",
    "Candidate experts (JSON, one per line, indexed):",
    ...input.experts.map((e, index) =>
      JSON.stringify({
        index,
        headline: e.headline,
        bio: e.bio,
        competencies: e.competencies.map((c) => COMPETENCIES[c]),
        sectors: e.sectors.map((s) => `${s} ${NACE_SECTIONS[s]}`),
        languages: e.languages.map((l) => LANGUAGES[l]),
        regions: e.regions.map((r) => REGIONS[r]),
        years_experience: e.years_experience,
        availability: AVAILABILITY[e.availability],
      }),
    ),
  ].join("\n");

  return { system, prompt };
}

export async function matchExperts(input: JudgeInput): Promise<MatchResult> {
  const model = pipelineModel();
  const { system, prompt } = buildPrompt(input);

  const { output, usage } = await generateText({
    model,
    system,
    prompt,
    output: Output.object({ schema: matchingSchema, name: "expert_matching" }),
    maxRetries: 0,
    abortSignal: input.signal,
  });

  return {
    matching: output,
    model,
    usage: { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens },
  };
}
