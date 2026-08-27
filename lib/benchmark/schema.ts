import { z } from "zod";

// Stage 3's Output.object schema (t-016-spec.md D2). The model judges; every
// number is then read from the stored peers in code (lib/runs/rank.ts).
export const MATURITY_LABELS = [
  "pathological",
  "reactive",
  "calculative",
  "proactive",
  "generative",
] as const;

export type MaturityLabel = (typeof MATURITY_LABELS)[number];

export const benchmarkJudgmentSchema = z.object({
  // What the peer set ranks on; null when nothing is comparable.
  rate_metric: z.enum(["TRIR", "LTIFR"]).nullable(),
  // Indices into the peer catalogue that are comparable on rate_metric:
  // same metric, per 1,000,000 hours worked, a real figure, same sector.
  comparable_peer_indices: z.array(z.number().int().nonnegative()),
  maturity_label: z.enum(MATURITY_LABELS),
  maturity_rationale: z.string(),
  verdict: z.string(),
});

export type BenchmarkJudgment = z.infer<typeof benchmarkJudgmentSchema>;
