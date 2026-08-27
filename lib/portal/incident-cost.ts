import type { KpiRow } from "@/lib/portal/kpis";
import type { DerivedFigures } from "@/lib/portal/ledger";
import { METRIC_LABELS } from "@/lib/runs/metrics";

// Annual incident cost — kpi-contract.md, "Loss model — absolute incident
// cost". It prices the incidents a company actually had; it is not a gap
// against peers, and it is computed here in code, never by the pipeline
// (pipeline-rules.md: "Math is code, judgment is AI").
//
// Source: the client's controlled document
// `context/product/EHS Management System_KPIs_ISO45004.docx`, per-incident
// table built from working hours lost at ~75 CHF/h across seven cost
// components. CHF per incident. The HCI-burn (29k) and first-aid (3k) rows
// need an injury type no count carries and stay unpriced (contract, Open).
export const LOSS_CHF = {
  // Doc row "Fatality — Death".
  fatality: 1_200_000,
  // Doc rows "Lost-time incident — broken bone" … "— amputation".
  lostTimeMin: 56_000,
  lostTimeMax: 88_000,
  // Doc row "Recordable incident — bruises, scratches".
  recordable: 15_000,
} as const;

export type CostRow = {
  key: "fatalities" | "lost_time" | "recordable";
  label: string;
  count: number;
  min: number;
  max: number;
};

export type IncidentCost = {
  rows: CostRow[];
  min: number;
  max: number;
  // Lost-time count absent while recordables are present: every recordable
  // priced at the recordable row, which the report must say.
  lostTimeUnknown: boolean;
  // Labels of the counts with no stored or derived figure — no row, a smaller
  // honest total.
  missing: string[];
  // The derived counts the waterfall consumed, label + formula, for the
  // "Derived counts used" note (design.md, Derived figures).
  derivedUsed: { label: string; value: number; formula: string }[];
};

function count(rows: readonly KpiRow[], metric: KpiRow["metric"]): number | null {
  const row = rows.find((r) => r.metric === metric);
  return row && row.value !== null ? row.value : null;
}

// The waterfall, in severity order. Null when no count exists at all: the
// contract forbids inventing a row, so there is nothing to price. A derived
// count stands in for a stored one exactly (design.md, Derived figures);
// fatalities are never derivable.
export function buildIncidentCost(
  rows: readonly KpiRow[],
  derived: DerivedFigures,
): IncidentCost | null {
  const fatalities = count(rows, "fatalities");
  const lostTime = count(rows, "lost_time_injuries") ?? derived.lost_time_injuries?.value ?? null;
  const recordables =
    count(rows, "total_recordable_injuries") ?? derived.total_recordable_injuries?.value ?? null;

  const derivedUsed = (
    [
      ["lost_time_injuries", derived.lost_time_injuries],
      ["total_recordable_injuries", derived.total_recordable_injuries],
    ] as const
  ).flatMap(([metric, figure]) =>
    figure && count(rows, metric) === null
      ? [{ label: METRIC_LABELS[metric], value: figure.value, formula: figure.formula }]
      : [],
  );

  const out: CostRow[] = [];

  if (fatalities !== null) {
    const cost = fatalities * LOSS_CHF.fatality;
    out.push({ key: "fatalities", label: "Fatalities", count: fatalities, min: cost, max: cost });
  }
  if (lostTime !== null) {
    out.push({
      key: "lost_time",
      label: "Lost-time injuries",
      count: lostTime,
      min: lostTime * LOSS_CHF.lostTimeMin,
      max: lostTime * LOSS_CHF.lostTimeMax,
    });
  }
  if (recordables !== null) {
    const remaining = Math.max(recordables - (lostTime ?? 0), 0);
    const cost = remaining * LOSS_CHF.recordable;
    out.push({
      key: "recordable",
      label: lostTime === null ? "Recordable injuries" : "Other recordable injuries",
      count: remaining,
      min: cost,
      max: cost,
    });
  }

  if (out.length === 0) return null;

  const missing: string[] = [];
  if (fatalities === null) missing.push(METRIC_LABELS.fatalities);
  if (lostTime === null) missing.push(METRIC_LABELS.lost_time_injuries);
  if (recordables === null) missing.push(METRIC_LABELS.total_recordable_injuries);

  return {
    rows: out,
    min: out.reduce((sum, row) => sum + row.min, 0),
    max: out.reduce((sum, row) => sum + row.max, 0),
    lostTimeUnknown: lostTime === null && recordables !== null,
    missing,
    derivedUsed,
  };
}

// Swiss style: CHF 1'200'000. de-CH emits the typographic apostrophe.
const chf = new Intl.NumberFormat("de-CH", {
  style: "currency",
  currency: "CHF",
  maximumFractionDigits: 0,
});

export function formatChf(value: number): string {
  return chf.format(value);
}

export function formatChfRange(min: number, max: number): string {
  return min === max ? formatChf(min) : `${formatChf(min)} – ${formatChf(max)}`;
}
