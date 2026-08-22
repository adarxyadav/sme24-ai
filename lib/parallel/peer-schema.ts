// The stage-3 peer output schema (t-016-spec.md): the JSON Schema Parallel
// validates against and the Zod mirror we parse with, as for ehs-schema.ts.
// Descriptions are instructions — they carry the comparability rules
// (pipeline-rules.md, Stage 3): figures as disclosed with their basis, never
// converted, official all-accident statistics excluded.

import { z } from "zod";

const peerSchema = z.object({
  company_name: z.string(),
  country: z.string().nullable(),
  trir: z.number().nullable(),
  trir_basis: z.string().nullable(),
  ltifr: z.number().nullable(),
  ltifr_basis: z.string().nullable(),
  reporting_year: z.string().nullable(),
  scope: z.enum(["employees", "combined"]).nullable(),
  source_url: z.string().nullable(),
  source_excerpt: z.string().nullable(),
  confidence: z.enum(["low", "medium", "high"]),
});

const referenceSchema = z.object({
  metric: z.enum(["TRIR", "LTIFR"]),
  basis: z.string().nullable(),
  median: z.number().nullable(),
  best_in_class: z.number().nullable(),
  source_url: z.string().nullable(),
  source_excerpt: z.string().nullable(),
  confidence: z.enum(["low", "medium", "high"]),
});

export const peerOutputSchema = z.object({
  industry: z.object({
    nace_code: z.string().nullable(),
    nace_label: z.string().nullable(),
    notes: z.string().nullable(),
  }),
  peers: z.array(peerSchema),
  references: z.array(referenceSchema),
});

export type PeerOutput = z.infer<typeof peerOutputSchema>;
export type PeerFinding = z.infer<typeof peerSchema>;
export type ReferenceFinding = z.infer<typeof referenceSchema>;

const RATE_DESCRIPTION =
  "The numeric rate exactly as disclosed for the stated reporting year. Null if this peer does not disclose it. Never convert from another basis, never estimate, never carry a figure over from a different company.";
const BASIS_DESCRIPTION =
  "The denominator exactly as stated, e.g. 'per 1,000,000 hours worked', 'per 200,000 hours', 'per 100 employees'. Null if the rate is null or the basis is not stated.";

export const PEER_JSON_SCHEMA = {
  type: "object",
  properties: {
    industry: {
      type: "object",
      properties: {
        nace_code: { type: ["string", "null"], description: "The NACE Rev. 2 code the peer set was selected for." },
        nace_label: { type: ["string", "null"], description: "Its official label." },
        notes: { type: ["string", "null"], description: "One or two sentences on how the peers were chosen and what the sector typically discloses." },
      },
      required: ["nace_code", "nace_label", "notes"],
      additionalProperties: false,
    },
    peers: {
      type: "array",
      description:
        "Five to ten companies in the same sector (same NACE division, similar activity), preferring Switzerland and Europe, that publicly disclose occupational injury rates. Never include the company being benchmarked. Include a peer only if at least one of its rates is actually published by that peer. Return an empty array if no peer discloses.",
      items: {
        type: "object",
        properties: {
          company_name: { type: "string", description: "The peer's name." },
          country: { type: ["string", "null"], description: "Headquarters country, ISO name." },
          trir: { type: ["number", "null"], description: `Total recordable injury/incident rate. ${RATE_DESCRIPTION}` },
          trir_basis: { type: ["string", "null"], description: BASIS_DESCRIPTION },
          ltifr: { type: ["number", "null"], description: `Lost-time injury frequency rate. ${RATE_DESCRIPTION}` },
          ltifr_basis: { type: ["string", "null"], description: BASIS_DESCRIPTION },
          reporting_year: { type: ["string", "null"], description: "The reporting year the figures cover, e.g. '2024'." },
          scope: { type: ["string", "null"], enum: ["employees", "combined", null], description: "'employees' only or 'combined' employees and contractors. Null if not stated." },
          source_url: { type: ["string", "null"], description: "Direct URL to the report or page disclosing the figures." },
          source_excerpt: { type: ["string", "null"], description: "A short verbatim quote containing the figure." },
          confidence: { type: "string", enum: ["low", "medium", "high"], description: "Confidence the figures are correct and belong to this peer." },
        },
        required: ["company_name", "country", "trir", "trir_basis", "ltifr", "ltifr_basis", "reporting_year", "scope", "source_url", "source_excerpt", "confidence"],
        additionalProperties: false,
      },
    },
    references: {
      type: "array",
      description:
        "Published sector-level reference rates: an industry median and a best-in-class figure per metric, from industry bodies, sector reports or statistical offices that report on the same basis as company disclosures. Exclude official all-accident statistics counted per 1,000 full-time equivalents (e.g. SUVA) — they are not comparable with TRIR or LTIFR. Return an empty array if none exists.",
      items: {
        type: "object",
        properties: {
          metric: { type: "string", enum: ["TRIR", "LTIFR"], description: "Which rate this reference is for." },
          basis: { type: ["string", "null"], description: BASIS_DESCRIPTION },
          median: { type: ["number", "null"], description: "The sector median or average, as published. Null if not published." },
          best_in_class: { type: ["number", "null"], description: "The best-in-class or top-quartile figure, as published. Null if not published." },
          source_url: { type: ["string", "null"], description: "Direct URL to the source." },
          source_excerpt: { type: ["string", "null"], description: "A short verbatim quote containing the figure." },
          confidence: { type: "string", enum: ["low", "medium", "high"], description: "Confidence the figure is correct and on the stated basis." },
        },
        required: ["metric", "basis", "median", "best_in_class", "source_url", "source_excerpt", "confidence"],
        additionalProperties: false,
      },
    },
  },
  required: ["industry", "peers", "references"],
  additionalProperties: false,
} as const;
