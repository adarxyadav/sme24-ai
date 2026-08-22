import { z } from "zod";
import { CANONICAL_METRICS, type CanonicalMetric } from "@/lib/runs/metrics";

// The stage-2 Output.object schema (t-005-spec.md D3). Derived from
// CANONICAL_METRICS so the contract's list has one source: a metric added in
// lib/runs/metrics.ts reaches the route, the form and this extractor from one
// edit, and a metric outside it fails validation before anything is written.

// kpi-contract.md, Supporting metrics: "Web extraction folds lost-time data
// under LTIFR, so research never fills this key." Everything else in the ask
// set is web-fillable.
const WEB_EXCLUDED: readonly CanonicalMetric[] = ["lost_time_injuries"];

export const WEB_EXTRACTABLE_METRICS = CANONICAL_METRICS.filter(
  (metric) => !WEB_EXCLUDED.includes(metric),
);

// z.enum needs a non-empty tuple; the filter above returns a plain array.
// The assertion is safe because CANONICAL_METRICS is a fixed seven-element
// tuple and WEB_EXCLUDED removes one.
const webMetricEnum = z.enum(
  WEB_EXTRACTABLE_METRICS as [CanonicalMetric, ...CanonicalMetric[]],
);

// The model maps, code copies: each entry names a stage-1 finding by index and
// the canonical metric it is this company's best figure for. The number, the
// quote and the URL are then projected from that finding in code, so a figure
// can only ever come from something Parallel cited -- never retyped.
export const kpiMappingSchema = z.object({
  metric: webMetricEnum,
  finding_index: z.number().int().nonnegative(),
  rationale: z.string(),
});

export const kpiExtractionSchema = z.object({
  kpis: z.array(kpiMappingSchema),
});

export type KpiMapping = z.infer<typeof kpiMappingSchema>;
export type KpiExtraction = z.infer<typeof kpiExtractionSchema>;
