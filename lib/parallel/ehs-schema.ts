// The stage-1 EHS output schema (t-004-spec.md D8). Two shapes of the same
// contract: the JSON Schema Parallel validates its own output against, and the
// Zod mirror we parse the response with before anything is written.
//
// Both exist on purpose. Parallel's validation keeps the model honest; ours
// keeps a provider-side shape change from landing in the research jsonb as
// malformed data that stage 2 trips over much later.

import { z } from "zod";

// Free text, as disclosed — NOT a canonical metric key. Mapping a disclosed
// label onto the canonical seven is stage 2's job (pipeline-rules.md), and
// constraining it here would make Parallel discard every figure whose mapping
// needs judgement rather than reporting it.
const findingSchema = z.object({
  metric: z.string(),
  value: z.number().nullable(),
  unit: z.string().nullable(),
  // The disclosed denominator, e.g. "per 1'000'000 hours worked". kpi-contract.md
  // forbids converting a rate across bases, so the base has to survive the hop
  // intact — a rate without its denominator is unusable, not merely imprecise.
  basis: z.string().nullable(),
  period: z.string().nullable(),
  scope: z.enum(["employees", "combined", "contractors"]).nullable(),
  source_url: z.string().nullable(),
  source_excerpt: z.string().nullable(),
  confidence: z.enum(["low", "medium", "high"]),
});

// Company context, not KPIs. headcount lives here because kpi-contract.md is
// explicit that it is not a safety metric — it is the fallback denominator for
// deriving hours worked at display time.
const companySchema = z.object({
  legal_name: z.string().nullable(),
  headcount: z.number().nullable(),
  country: z.string().nullable(),
  description: z.string().nullable(),
});

// Best-effort NACE. Stage 3's input for peer selection.
const sectorSchema = z.object({
  nace_code: z.string().nullable(),
  nace_label: z.string().nullable(),
  confidence: z.enum(["low", "medium", "high"]),
});

// The honest "we looked and found nothing" signal. Without it, an empty
// findings array is ambiguous between "no disclosure" and "the search failed",
// and no_data must only be set for the first (t-004-spec.md D8).
const disclosureSchema = z.object({
  has_ehs_disclosure: z.boolean(),
  sources_checked: z.array(z.string()),
  notes: z.string().nullable(),
});

export const ehsOutputSchema = z.object({
  company: companySchema,
  sector: sectorSchema,
  findings: z.array(findingSchema),
  disclosure: disclosureSchema,
});

export type EhsOutput = z.infer<typeof ehsOutputSchema>;
export type EhsFinding = z.infer<typeof findingSchema>;

// Parallel's own per-field provenance, stored verbatim alongside our parsed
// output. The Check names basis[] citations and per-field confidence as things
// research must carry; keeping the provider's array intact means provenance is
// never lossily re-derived from it.
export const parallelBasisSchema = z.array(
  z.object({
    field: z.string(),
    citations: z.array(
      z.object({
        title: z.string().nullable().optional(),
        url: z.string(),
        excerpts: z.array(z.string()).optional(),
      }),
    ),
    reasoning: z.string().optional(),
    confidence: z.string().optional(),
  }),
);

export type ParallelBasis = z.infer<typeof parallelBasisSchema>;

// The JSON Schema sent to Parallel. Hand-written rather than generated from the
// Zod schema above: Parallel reads the description strings as instructions, and
// they are the difference between a disclosed figure and an invented one.
// The two shapes are kept in step by ehs-schema's single reviewer — a mismatch
// surfaces immediately as a Zod parse failure on the first live run.
export const EHS_JSON_SCHEMA = {
  type: "object",
  properties: {
    company: {
      type: "object",
      properties: {
        legal_name: { type: ["string", "null"], description: "The company's full registered legal name." },
        headcount: { type: ["number", "null"], description: "Total employees, most recent disclosed figure. Null if not disclosed." },
        country: { type: ["string", "null"], description: "Country of the company's headquarters, ISO name." },
        description: { type: ["string", "null"], description: "One or two sentences on what the company does." },
      },
      required: ["legal_name", "headcount", "country", "description"],
      additionalProperties: false,
    },
    sector: {
      type: "object",
      properties: {
        nace_code: { type: ["string", "null"], description: "Best-effort NACE Rev. 2 code, e.g. '41.20'. Null if it cannot be determined." },
        nace_label: { type: ["string", "null"], description: "The NACE code's official label." },
        confidence: { type: "string", enum: ["low", "medium", "high"], description: "Confidence in the NACE classification." },
      },
      required: ["nace_code", "nace_label", "confidence"],
      additionalProperties: false,
    },
    findings: {
      type: "array",
      description:
        "One entry per occupational health and safety figure the company has publicly disclosed. Include only figures actually published by or about this company — never an industry average, never an estimate, never a figure carried over from a different company. Return an empty array if nothing is disclosed.",
      items: {
        type: "object",
        properties: {
          metric: { type: "string", description: "The metric exactly as the source names it, e.g. 'Total Recordable Incident Rate', 'Lost Time Injury Frequency Rate', 'Fatalities', 'Near misses'." },
          value: { type: ["number", "null"], description: "The numeric value as disclosed. Null if the source names the metric without a figure." },
          unit: { type: ["string", "null"], description: "The unit as disclosed, e.g. 'rate', 'count', 'hours'." },
          basis: { type: ["string", "null"], description: "The denominator exactly as stated, e.g. 'per 1,000,000 hours worked', 'per 200,000 hours', 'per 100 employees', 'per 1,000 FTE'. Critical: never convert a rate to a different basis, and never assume a basis the source does not state." },
          period: { type: ["string", "null"], description: "The reporting period the figure covers, e.g. '2024' or 'FY2023/24'." },
          scope: { type: ["string", "null"], enum: ["employees", "combined", "contractors", null], description: "Whose figures these are: 'employees' only, 'combined' employees and contractors, or 'contractors' only. Null if the source does not say." },
          source_url: { type: ["string", "null"], description: "Direct URL to the document or page disclosing this figure." },
          source_excerpt: { type: ["string", "null"], description: "A short verbatim quote from the source containing the figure." },
          confidence: { type: "string", enum: ["low", "medium", "high"], description: "Confidence that this figure is correct and belongs to this company." },
        },
        required: ["metric", "value", "unit", "basis", "period", "scope", "source_url", "source_excerpt", "confidence"],
        additionalProperties: false,
      },
    },
    disclosure: {
      type: "object",
      properties: {
        has_ehs_disclosure: { type: "boolean", description: "True if the company publishes any occupational health and safety performance data at all, even figures not captured above." },
        sources_checked: { type: "array", items: { type: "string" }, description: "URLs of the sources examined, including those that turned out to hold no safety data." },
        notes: { type: ["string", "null"], description: "Brief note on the state of disclosure, e.g. 'Publishes a sustainability report but no injury rates.'" },
      },
      required: ["has_ehs_disclosure", "sources_checked", "notes"],
      additionalProperties: false,
    },
  },
  required: ["company", "sector", "findings", "disclosure"],
  additionalProperties: false,
} as const;
