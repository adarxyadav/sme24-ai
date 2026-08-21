import "server-only";
import { EHS_JSON_SCHEMA, ehsOutputSchema, parallelBasisSchema, type EhsOutput, type ParallelBasis } from "@/lib/parallel/ehs-schema";

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
  companyName: string,
  companyDomain: string | null,
  processor: ProcessorTier,
  signal?: AbortSignal,
): Promise<string> {
  const response = await fetch(`${API_BASE}/tasks/runs`, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", "x-api-key": apiKey() },
    body: JSON.stringify({
      input: buildInput(companyName, companyDomain),
      processor,
      task_spec: { output_schema: { type: "json", json_schema: EHS_JSON_SCHEMA } },
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

async function fetchResult(
  parallelRunId: string,
  maxWaitSeconds: number,
  signal?: AbortSignal,
): Promise<{ output: EhsOutput; basis: ParallelBasis }> {
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

    const parsedOutput = ehsOutputSchema.safeParse(content?.content);
    if (!parsedOutput.success) {
      throw new ParallelError("Parallel output did not match the EHS schema");
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
export async function researchCompany({
  companyName,
  companyDomain,
  processor,
  maxWaitSeconds,
  signal,
}: {
  companyName: string;
  companyDomain: string | null;
  processor: ProcessorTier;
  maxWaitSeconds: number;
  signal?: AbortSignal;
}): Promise<ParallelResearch> {
  const parallelRunId = await createRun(companyName, companyDomain, processor, signal);
  const { output, basis } = await fetchResult(parallelRunId, maxWaitSeconds, signal);
  return { parallelRunId, output, basis };
}
