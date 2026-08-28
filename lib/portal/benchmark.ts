import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  comparablePeerRates,
  deriveRank,
  type BenchmarkComparison,
} from "@/lib/runs/rank";

// Stage 3's output for the dashboard. RLS-scoped like every read here. Rank
// and peer count are re-derived from the stored peers by the same function the
// engine used, so figure and table cannot disagree (pipeline-rules.md, Stage 3).

export type MaturityLabel =
  | "pathological"
  | "reactive"
  | "calculative"
  | "proactive"
  | "generative";

// The pipeline always emits Hudson labels; the bottom rung is softened for the
// client (pipeline-rules.md, Maturity scale).
export const MATURITY_DISPLAY: Record<MaturityLabel, string> = {
  pathological: "Emerging",
  reactive: "Reactive",
  calculative: "Calculative",
  proactive: "Proactive",
  generative: "Generative",
};

export type Benchmark = {
  rate_metric: "TRIR" | "LTIFR" | null;
  rank: number | null;
  peer_count: number;
  // The ranked figures behind the rank, for the position strip — same
  // function at write and read time, so strip and rank cannot disagree.
  comparable_rates: number[];
  verdict: string | null;
  maturity_label: MaturityLabel | null;
  maturity_rationale: string | null;
  comparison: BenchmarkComparison;
  // Neither peers nor references: the section states insufficient data.
  insufficient: boolean;
};

type StoredBenchmark = {
  verdict: string | null;
  maturity_label: MaturityLabel | null;
  maturity_rationale: string | null;
  per_metric_comparison: BenchmarkComparison;
};

export async function getRunBenchmark(runId: string): Promise<Benchmark | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("benchmarks")
    .select("verdict, maturity_label, maturity_rationale, per_metric_comparison")
    .eq("run_id", runId)
    .maybeSingle<StoredBenchmark>();

  if (error) {
    console.error("benchmark lookup failed", runId, error.message);
    return null;
  }
  if (!data) return null;

  const comparison = data.per_metric_comparison;
  const { rank, peerCount } = deriveRank(comparison);

  return {
    rate_metric: comparison.rate_metric,
    rank,
    peer_count: peerCount,
    comparable_rates: comparablePeerRates(comparison),
    verdict: data.verdict,
    maturity_label: data.maturity_label,
    maturity_rationale: data.maturity_rationale,
    comparison,
    insufficient: comparison.peers.length === 0 && comparison.references === null,
  };
}
