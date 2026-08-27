import {
  CANONICAL_METRICS,
  METRIC_HINTS,
  METRIC_LABELS,
  type CanonicalMetric,
} from "@/lib/runs/metrics";
import type { KpiRow } from "@/lib/portal/kpis";

// kpi-contract.md, Show: web metrics always render — found or an honest "not
// disclosed" — while client-only metrics render only when supplied. Research
// never fills lost_time_injuries (it folds under LTIFR), so it is the one
// canonical metric with no standing row.
const CLIENT_ONLY_METRICS: ReadonlySet<CanonicalMetric> = new Set([
  "lost_time_injuries",
]);

export type LedgerRow = {
  metric: CanonicalMetric;
  label: string;
  hint: string;
  // Null = not disclosed; the stored row, when present, carries the provenance.
  kpi: KpiRow | null;
};

// One row per canonical metric in contract order; stored rows are joined by
// metric. Nothing is derived here — the derivation rules in kpi-contract.md
// (counts from rate × hours, the CHF loss model) are Later, not this ledger.
export function buildLedger(rows: readonly KpiRow[]): LedgerRow[] {
  const byMetric = new Map(rows.map((row) => [row.metric, row]));

  return CANONICAL_METRICS.flatMap((metric) => {
    const kpi = byMetric.get(metric) ?? null;
    if (!kpi && CLIENT_ONLY_METRICS.has(metric)) return [];
    return [
      { metric, label: METRIC_LABELS[metric], hint: METRIC_HINTS[metric], kpi },
    ];
  });
}

// The contract writes figures in the Swiss style (1'000'000); de-CH is the
// locale that produces it.
const numberFormat = new Intl.NumberFormat("de-CH", {
  maximumFractionDigits: 2,
});

export function formatValue(value: number): string {
  return numberFormat.format(value);
}
