import "server-only";
import { generateText, Output } from "ai";
import type { EhsFinding } from "@/lib/parallel/ehs-schema";
import {
  CANONICAL_METRICS,
  RATE_METRICS,
  METRIC_HINTS,
  type CanonicalMetric,
} from "@/lib/runs/metrics";
import {
  kpiExtractionSchema,
  WEB_EXTRACTABLE_METRICS,
  type KpiMapping,
} from "@/lib/extraction/schema";

// Stage 2's model call and the finding -> row projection (t-005-spec.md D3,
// D6). Reached only from trigger/kpi-extraction.ts: AGENTS.md puts every AI
// call in a trigger/ task, and `server-only` keeps this out of any app bundle.

// pipeline-rules.md, Stack: one model for every Claude call in the pipeline,
// routed through the AI Gateway as a plain provider/model string
// (library-docs.md). PIPELINE_MODEL is the testing-only override.
const DEFAULT_MODEL = "anthropic/claude-sonnet-5";

export function pipelineModel(): string {
  return process.env.PIPELINE_MODEL || DEFAULT_MODEL;
}

export type ExtractedKpiRow = {
  metric: CanonicalMetric;
  value: number;
  unit: string | null;
  period: string | null;
  source_url: string | null;
  source_excerpt: string | null;
  confidence: "low" | "medium" | "high";
  origin: "web" | "upload";
};

// The catalogue stage 2 maps over: web findings plus, when the client uploaded
// a report, its findings tagged `upload` (t-020-spec.md D3). The tag rides
// with the finding so the projected row keeps its provenance.
export type CatalogueFinding = EhsFinding & { origin: "web" | "upload" };

type MapFindingsInput = {
  companyName: string;
  findings: CatalogueFinding[];
  // Metrics the client supplied: listed as "do not fill" so no judgment is
  // spent on them. The database enforces the rule; this only saves tokens.
  clientMetrics: CanonicalMetric[];
  clientPeriod: string | null;
  signal?: AbortSignal;
};

export type MapFindingsResult = {
  mappings: KpiMapping[];
  // Null when no model call was made (nothing to map or nothing to fill).
  model: string | null;
  usage: { inputTokens: number | undefined; outputTokens: number | undefined } | null;
};

function buildPrompt({
  companyName,
  findings,
  clientMetrics,
  clientPeriod,
}: Omit<MapFindingsInput, "signal">): { system: string; prompt: string } {
  const targets = WEB_EXTRACTABLE_METRICS.filter((metric) => !clientMetrics.includes(metric));
  const targetLines = targets.map((metric) => `- ${metric}: ${METRIC_HINTS[metric]}`).join("\n");

  const system = [
    "You normalise occupational health and safety disclosures into a fixed set of canonical KPIs.",
    "You are given the figures a research step found for one company, each with an index. For each canonical metric you can fill, name the single finding that is this company's best figure for it.",
    "Rules:",
    "- Only map a finding whose label genuinely means the canonical metric. TRIR is a total recordable injury/incident rate; LTIFR is a lost-time injury frequency rate. Do not map one onto the other.",
    "- Never map a finding whose value is null.",
    "- One finding per metric, and a finding may serve at most one metric.",
    clientPeriod
      ? `- Period: prefer the finding whose period matches "${clientPeriod}"; otherwise the most recent period.`
      : "- Period: prefer the most recent period.",
    "- Scope: prefer 'employees' over 'combined' over an unstated scope, at the same period.",
    "- Rates: prefer a finding whose basis is per 1,000,000 hours worked. If the only figure for a rate is on another basis, you may still map it — the basis is stored with it and is never converted.",
    "- Counts must be whole-company annual counts for one period, not multi-year totals.",
    "- If no finding fits a metric, leave that metric out. An empty list is a valid answer.",
    "- Findings with origin 'upload' come from the company's own uploaded report and override web findings: for any metric the uploaded report states, map the upload finding, not a web one.",
    "- Rationale: one short sentence on why this finding is the right one.",
  ].join("\n");

  const catalogue = findings.map((finding, index) => ({
    index,
    origin: finding.origin,
    metric: finding.metric,
    value: finding.value,
    unit: finding.unit,
    basis: finding.basis,
    period: finding.period,
    scope: finding.scope,
    confidence: finding.confidence,
  }));

  const prompt = [
    `Company: ${companyName}`,
    "",
    "Canonical metrics to fill:",
    targetLines,
    "",
    "Findings (JSON, one per line, indexed):",
    ...catalogue.map((entry) => JSON.stringify(entry)),
  ].join("\n");

  return { system, prompt };
}

// The judgment half of stage 2. Skips the model entirely when there is nothing
// to judge: no finding carries a value, or the client already supplied every
// web-fillable metric.
export async function mapFindings(input: MapFindingsInput): Promise<MapFindingsResult> {
  const hasValues = input.findings.some((finding) => finding.value !== null);
  const hasTargets = WEB_EXTRACTABLE_METRICS.some(
    (metric) => !input.clientMetrics.includes(metric),
  );

  if (!hasValues || !hasTargets) {
    return { mappings: [], model: null, usage: null };
  }

  const model = pipelineModel();
  const { system, prompt } = buildPrompt(input);

  const { output, usage } = await generateText({
    model,
    system,
    prompt,
    output: Output.object({ schema: kpiExtractionSchema, name: "kpi_mapping" }),
    // Trigger.dev owns retries (backoff >= 60s, pipeline-rules.md); the SDK's
    // own loop would stack a second one inside the first.
    maxRetries: 0,
    abortSignal: input.signal,
  });

  return {
    mappings: output.kpis,
    model,
    usage: { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens },
  };
}

// The canonical gate. Typed as string on purpose: every metric that reaches
// the write path passes through here, whatever produced it, and the Check's
// "no metric outside the canonical list is ever written" is this comparison.
function isCanonicalMetric(metric: string): metric is CanonicalMetric {
  return (CANONICAL_METRICS as readonly string[]).includes(metric);
}

function isRateMetric(metric: CanonicalMetric): boolean {
  return (RATE_METRICS as readonly string[]).includes(metric);
}

// The arithmetic-free half: copy the figure, the quote and the URL from the
// finding the model named. Throws rather than skipping on anything malformed,
// because a silently dropped row and a wrong row are indistinguishable later.
export function projectRows({
  findings,
  mappings,
}: {
  findings: CatalogueFinding[];
  mappings: Array<{ metric: string; finding_index: number }>;
}): ExtractedKpiRow[] {
  const seen = new Set<string>();
  const rows: ExtractedKpiRow[] = [];

  for (const mapping of mappings) {
    if (!isCanonicalMetric(mapping.metric)) {
      throw new Error(`non-canonical metric rejected: ${mapping.metric}`);
    }
    if (seen.has(mapping.metric)) {
      throw new Error(`duplicate metric in extraction: ${mapping.metric}`);
    }
    seen.add(mapping.metric);

    const finding = findings[mapping.finding_index];
    if (!finding) {
      throw new Error(`finding index out of range: ${mapping.finding_index}`);
    }
    // T-004's verification record: some findings name a metric without a
    // figure. They are skipped by the prompt and rejected here — never zero.
    if (finding.value === null) {
      throw new Error(`finding ${mapping.finding_index} has no value`);
    }

    const unit = isRateMetric(mapping.metric)
      ? (finding.basis ?? finding.unit)
      : mapping.metric === "hours_worked"
        ? "hours"
        : (finding.unit ?? "count");

    rows.push({
      metric: mapping.metric,
      value: finding.value,
      unit,
      period: finding.period,
      source_url: finding.source_url,
      source_excerpt: finding.source_excerpt,
      confidence: finding.confidence,
      origin: finding.origin,
    });
  }

  return rows;
}
