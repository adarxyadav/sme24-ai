import {
  CANONICAL_METRICS,
  METRIC_HINTS,
  METRIC_LABELS,
  type CanonicalMetric,
} from "@/lib/runs/metrics";
import { isPerMillionHours } from "@/lib/runs/rank";
import type { KpiRow } from "@/lib/portal/kpis";

// The contract order the ledger renders in — re-exported so dashboard
// components read it through the portal boundary (t-006-spec.md D1).
export { CANONICAL_METRICS } from "@/lib/runs/metrics";

// kpi-contract.md, Show: web metrics always render — found or an honest "not
// disclosed" — while client-only metrics render only when supplied or derived.
// Research never fills lost_time_injuries (it folds under LTIFR), so it is the
// one canonical metric with no standing row.
const CLIENT_ONLY_METRICS: ReadonlySet<CanonicalMetric> = new Set([
  "lost_time_injuries",
]);

// A display-time derivation (kpi-contract.md, Derivation rules; design.md,
// Derived figures): computed context, never presented as a disclosure. The
// formula string is what renders under the ≈ value; inputs is the prose for
// the Source cell ("Derived from <inputs>").
export type DerivedFigure = {
  value: number;
  formula: string;
  inputs: string;
};

export type DerivedFigures = Partial<Record<CanonicalMetric, DerivedFigure>>;

export type LedgerRow = {
  metric: CanonicalMetric;
  label: string;
  hint: string;
  // Null = not disclosed; the stored row, when present, carries the provenance.
  kpi: KpiRow | null;
  // Set only when no stored value exists for the metric.
  derived: DerivedFigure | null;
};

type ValuedKpi = KpiRow & { value: number };

// A rate feeds a count only on the contract base: a disclosed unit must read
// per 1'000'000 hours, and a client figure is on that base by construction —
// the form asks on it (kpi-contract.md).
function onContractBase(kpi: KpiRow): boolean {
  return kpi.origin === "client" || isPerMillionHours(kpi.unit);
}

// The derivation rules the ledger and the incident-cost card share. Counts
// derive from stored rows only (design.md): hours derived from headcount is
// shown as a figure but never feeds a count.
export function deriveFigures(
  rows: readonly KpiRow[],
  headcount: number | null,
): DerivedFigures {
  const byMetric = new Map(rows.map((row) => [row.metric, row]));
  const valued = (metric: CanonicalMetric): ValuedKpi | null => {
    const row = byMetric.get(metric);
    // Assertion mirrors the null check on the line above.
    return row && row.value !== null ? (row as ValuedKpi) : null;
  };

  const out: DerivedFigures = {};

  const hours = valued("hours_worked");
  if (!hours && headcount !== null && headcount > 0) {
    out.hours_worked = {
      value: headcount * 1_880,
      formula: `${formatValue(headcount)} employees × ${formatValue(1_880)} h`,
      inputs: "the disclosed headcount",
    };
  }

  if (hours) {
    const deriveCount = (
      metric: "total_recordable_injuries" | "lost_time_injuries",
      rateMetric: "TRIR" | "LTIFR",
    ) => {
      const rate = valued(rateMetric);
      if (valued(metric) || !rate || !onContractBase(rate)) return;
      out[metric] = {
        value: Math.round((rate.value * hours.value) / 1_000_000),
        formula: `${METRIC_LABELS[rateMetric]} ${formatValue(rate.value)} × ${formatValue(hours.value)} h ÷ ${formatValue(1_000_000)}`,
        inputs: `${METRIC_LABELS[rateMetric]} and ${METRIC_LABELS.hours_worked.toLowerCase()}`,
      };
    };
    deriveCount("total_recordable_injuries", "TRIR");
    deriveCount("lost_time_injuries", "LTIFR");
  }

  return out;
}

// One row per canonical metric in contract order; stored rows are joined by
// metric, derived figures fill in where no stored value exists.
export function buildLedger(
  rows: readonly KpiRow[],
  derivedFigures: DerivedFigures,
): LedgerRow[] {
  const byMetric = new Map(rows.map((row) => [row.metric, row]));

  return CANONICAL_METRICS.flatMap((metric) => {
    const kpi = byMetric.get(metric) ?? null;
    const derived =
      kpi?.value === null || kpi === null ? (derivedFigures[metric] ?? null) : null;
    if (!kpi && !derived && CLIENT_ONLY_METRICS.has(metric)) return [];
    return [
      { metric, label: METRIC_LABELS[metric], hint: METRIC_HINTS[metric], kpi, derived },
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
