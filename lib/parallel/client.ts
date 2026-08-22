import "server-only";
import type { z } from "zod";
import { EHS_JSON_SCHEMA, ehsOutputSchema, parallelBasisSchema, type EhsOutput, type ParallelBasis } from "@/lib/parallel/ehs-schema";
import { PEER_JSON_SCHEMA, peerOutputSchema, type PeerOutput } from "@/lib/parallel/peer-schema";

// The Parallel Task API (t-004-spec.md D7). Two endpoints against a documented
// REST API, so plain fetch rather than the vendor SDK — the SDK's value here is
// the polling loop, which we write anyway to bound it against the task's
// maxDuration.
//
// Parallel receives public company identifiers only: name and, when supplied,
// domain. Never runId, never user_id, never client KPI values
// (pipeline-rules.md hard rule; library-docs.md, Parallel Task API).

const API_BASE = "https://api.parallel.ai/v1";

// Read per call, matching lib/supabase/env.ts: a module-scope read would make
// every importer satisfy the variable, so a missing key would break surfaces
// that never call Parallel.
function apiKey(): string {
  const value = process.env.PARALLEL_API_KEY;
  if (!value) throw new Error("Missing environment variable PARALLEL_API_KEY");
  return value;
}

export type ProcessorTier = "base" | "ultra";

export type ParallelResearch = {
  parallelRunId: string;
  output: EhsOutput;
  basis: ParallelBasis;
};

// Thrown when Parallel itself fails. Distinct from an empty result: the task
// turns this into a retry and eventually `failed`, never `no_data`
// (t-004-spec.md D8).
export class ParallelError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "ParallelError";
  }
}

// The research prompt. Public identifiers only, and an explicit instruction
// against invented figures — pipeline-rules.md: never present a guessed number
// as fact.
function buildInput(companyName: string, companyDomain: string | null): string {
  const identity = companyDomain ? `${companyName} (${companyDomain})` : companyName;
  return [
    `Research the occupational health and safety (EHS) disclosures of the company: ${identity}.`,
    "Find every safety performance figure this specific company has published — injury rates, incident counts, fatalities, near misses, hours worked — in sustainability reports, annual reports, ESG data tables, and regulatory filings.",
    "Record each figure exactly as disclosed, with its stated denominator and the period it covers. Do not convert rates between bases. Do not estimate, infer, or substitute an industry average for a figure the company has not published.",
    "If the company publishes no safety performance data, say so via the disclosure field and return an empty findings array.",
  ].join(" ");
}

async function createRun(
  input: string,
  processor: ProcessorTier,
  jsonSchema: object,
  signal?: AbortSignal,
): Promise<string> {
  const response = await fetch(`${API_BASE}/tasks/runs`, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", "x-api-key": apiKey() },
    body: JSON.stringify({
      input,
      processor,
      task_spec: { output_schema: { type: "json", json_schema: jsonSchema } },
    }),
  });

  if (!response.ok) {
    throw new ParallelError(`Parallel run creation failed: ${response.status}`, response.status);
  }

  const body: unknown = await response.json();
  const runId = (body as { run_id?: unknown })?.run_id;
  if (typeof runId !== "string") {
    throw new ParallelError("Parallel run creation returned no run_id");
  }
  return runId;
}

// The result endpoint long-polls: it holds the connection open server-side
// until the result is ready, and returns 408 when the window closes. So this
// loop is a handful of blocking reads, not a busy wait — no sleep between
// attempts, because each attempt already waited.
const POLL_TIMEOUT_SECONDS = 25;

async function fetchResult<T>(
  parallelRunId: string,
  maxWaitSeconds: number,
  outputSchema: z.ZodType<T>,
  signal?: AbortSignal,
): Promise<{ output: T; basis: ParallelBasis }> {
  const attempts = Math.max(1, Math.ceil(maxWaitSeconds / POLL_TIMEOUT_SECONDS));

  for (let attempt = 0; attempt < attempts; attempt++) {
    const response = await fetch(
      `${API_BASE}/tasks/runs/${parallelRunId}/result?timeout=${POLL_TIMEOUT_SECONDS}`,
      { headers: { "x-api-key": apiKey() }, signal },
    );

    // Not ready inside this window — go round again. Any other non-OK status is
    // a real failure and must not be retried into the timeout budget.
    if (response.status === 408 || response.status === 504) continue;

    if (!response.ok) {
      throw new ParallelError(`Parallel result failed: ${response.status}`, response.status);
    }

    const body: unknown = await response.json();
    const content = (body as { output?: { content?: unknown; basis?: unknown } })?.output;

    const parsedOutput = outputSchema.safeParse(content?.content);
    if (!parsedOutput.success) {
      throw new ParallelError("Parallel output did not match the expected schema");
    }

    // Provenance is stored verbatim, so a shape we do not recognise degrades to
    // an empty array rather than failing the run — the parsed findings still
    // carry their own source_url and confidence.
    const parsedBasis = parallelBasisSchema.safeParse(content?.basis);

    return {
      output: parsedOutput.data,
      basis: parsedBasis.success ? parsedBasis.data : [],
    };
  }

  throw new ParallelError(`Parallel result not ready within ${maxWaitSeconds}s`);
}

// signal comes from the task's run context: a cancelled run (a redeploy, a
// stalled worker, maxDuration) aborts the in-flight request instead of leaving
// it hanging until the process dies.
//
// onRunCreated fires as soon as Parallel has accepted the run and before the
// result wait begins: the paid run now exists, and the caller records its id
// so a task that dies mid-wait still names it (T-013).
export async function researchCompany({
  companyName,
  companyDomain,
  processor,
  maxWaitSeconds,
  signal,
  onRunCreated,
}: {
  companyName: string;
  companyDomain: string | null;
  processor: ProcessorTier;
  maxWaitSeconds: number;
  signal?: AbortSignal;
  onRunCreated?: (parallelRunId: string) => Promise<void>;
}): Promise<ParallelResearch> {
  const parallelRunId = await createRun(
    buildInput(companyName, companyDomain),
    processor,
    EHS_JSON_SCHEMA,
    signal,
  );
  await onRunCreated?.(parallelRunId);
  const { output, basis } = await fetchResult(parallelRunId, maxWaitSeconds, ehsOutputSchema, signal);
  return { parallelRunId, output, basis };
}

// Stage 3's peer call (pipeline-rules.md, Stage 3: Parallel, never cached;
// Escalation: base by default). Receives the company's public name and its
// sector — never its KPIs, never customer data.
function buildPeerInput({
  companyName,
  naceCode,
  naceLabel,
  country,
  headcount,
}: {
  companyName: string;
  naceCode: string | null;
  naceLabel: string | null;
  country: string | null;
  headcount: number | null;
}): string {
  const sector = naceCode ? `NACE ${naceCode}${naceLabel ? ` (${naceLabel})` : ""}` : (naceLabel ?? "its sector");
  return [
    `Find publicly disclosed occupational injury rates of peer companies of ${companyName}${country ? ` (${country})` : ""}, operating in ${sector}${headcount ? `, of broadly similar size (about ${headcount} employees)` : ""}.`,
    "Prefer peers headquartered in Switzerland or Europe; do not include the company itself.",
    "For each peer record the total recordable injury rate (TRIR) and the lost-time injury frequency rate (LTIFR) exactly as disclosed, each with its stated denominator, the reporting year, whose figures they are (employees or combined with contractors), and the source URL.",
    "Also record published sector reference rates (median and best-in-class) with their basis and source. Exclude official all-accident statistics per 1,000 full-time equivalents such as SUVA's — they are not comparable with TRIR or LTIFR.",
    "Never convert a rate to another basis, never estimate, never invent a figure; a peer that discloses nothing is simply omitted.",
  ].join(" ");
}

export type ParallelPeers = {
  parallelRunId: string;
  output: PeerOutput;
  basis: ParallelBasis;
};

export async function benchmarkPeers({
  companyName,
  naceCode,
  naceLabel,
  country,
  headcount,
  processor,
  maxWaitSeconds,
  signal,
  onRunCreated,
}: {
  companyName: string;
  naceCode: string | null;
  naceLabel: string | null;
  country: string | null;
  headcount: number | null;
  processor: ProcessorTier;
  maxWaitSeconds: number;
  signal?: AbortSignal;
  onRunCreated?: (parallelRunId: string) => Promise<void>;
}): Promise<ParallelPeers> {
  const parallelRunId = await createRun(
    buildPeerInput({ companyName, naceCode, naceLabel, country, headcount }),
    processor,
    PEER_JSON_SCHEMA,
    signal,
  );
  await onRunCreated?.(parallelRunId);
  const { output, basis } = await fetchResult(parallelRunId, maxWaitSeconds, peerOutputSchema, signal);
  return { parallelRunId, output, basis };
}
