// The canonical ask set (kpi-contract.md, "Ask set — the canonical 7"). The
// form's fields, the route's validation and stage-2 extraction all key on this
// list; nothing outside the contract is ever a valid metric.

export const RATE_METRICS = ["TRIR", "LTIFR"] as const;

// Counts, so integers. Rates stay floating point.
export const COUNT_METRICS = [
  "total_recordable_injuries",
  "lost_time_injuries",
  "fatalities",
  "near_misses",
  "hours_worked",
] as const;

export const CANONICAL_METRICS = [...RATE_METRICS, ...COUNT_METRICS] as const;

export type CanonicalMetric = (typeof CANONICAL_METRICS)[number];

export const METRIC_LABELS: Record<CanonicalMetric, string> = {
  TRIR: "TRIR",
  LTIFR: "LTIFR",
  total_recordable_injuries: "Recordable injuries",
  lost_time_injuries: "Lost-time injuries",
  fatalities: "Fatalities",
  near_misses: "Near misses",
  hours_worked: "Hours worked",
};

export const METRIC_HINTS: Record<CanonicalMetric, string> = {
  TRIR: "Per 1'000'000 hours worked",
  LTIFR: "Per 1'000'000 hours worked",
  total_recordable_injuries: "Count, past year",
  lost_time_injuries: "Count, past year",
  fatalities: "Count, past year",
  near_misses: "Count, past year",
  hours_worked: "Total hours, past year",
};
