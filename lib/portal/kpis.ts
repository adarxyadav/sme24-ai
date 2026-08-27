import "server-only";
import { createClient } from "@/lib/supabase/server";
import { CANONICAL_METRICS, type CanonicalMetric } from "@/lib/runs/metrics";

export type Confidence = "low" | "medium" | "high";
export type KpiOrigin = "web" | "upload" | "client";

export type KpiRow = {
  metric: CanonicalMetric;
  value: number | null;
  unit: string | null;
  period: string | null;
  source_url: string | null;
  source_excerpt: string | null;
  confidence: Confidence;
  origin: KpiOrigin;
};

// PostgREST serialises `numeric` as a string; everything else arrives typed.
type StoredKpi = Omit<KpiRow, "metric" | "value"> & {
  metric: string;
  value: string | null;
};

function isCanonical(metric: string): metric is CanonicalMetric {
  return (CANONICAL_METRICS as readonly string[]).includes(metric);
}

// RLS-scoped like every read here: the kpis policy joins to the owner's runs,
// so another user's run yields zero rows rather than an error. A metric outside
// the canonical list cannot be written (stage 2's gate), but if one ever were,
// dropping the row keeps one bad row from blanking a report.
export async function getRunKpis(runId: string): Promise<KpiRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kpis")
    .select(
      "metric, value, unit, period, source_url, source_excerpt, confidence, origin",
    )
    .eq("run_id", runId)
    .returns<StoredKpi[]>();

  if (error) {
    console.error("kpi lookup failed", runId, error.message);
    return [];
  }

  return data.flatMap((row) =>
    isCanonical(row.metric)
      ? [
          {
            ...row,
            metric: row.metric,
            value: row.value === null ? null : Number(row.value),
          },
        ]
      : [],
  );
}
