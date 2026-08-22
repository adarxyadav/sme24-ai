import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// The only writer of agent_logs. Pipeline internals live here and never reach
// the UI (AGENTS.md; pipeline-rules.md) — the table has every grant revoked from
// anon/authenticated and no policies, so only the service role reaches it.
//
// The Check's "proven from agent_logs" reads these rows, so the messages are a
// contract, not prose: they are matched on exactly.

export const LOG_MESSAGES = {
  clientKpis: "client kpis read",
  cacheHit: "cache hit",
  cacheMiss: "cache miss",
  parallelCreated: "parallel run created",
  researchStored: "research stored",
  noData: "no data",
  failed: "stage failed",
  cancelled: "run cancelled",
  alreadyClaimed: "run already claimed",
  sweptQueued: "queued run swept",
  enqueueFailed: "enqueue failed",
  extractionStarted: "extraction started",
  kpisExtracted: "kpis extracted",
  runCompleted: "run completed",
  extractionFailed: "extraction failed",
  sweptStalled: "stalled run swept",
  livenessUnknown: "liveness unknown",
  benchmarkingStarted: "benchmarking started",
  peersGathered: "peers gathered",
  benchmarkStored: "benchmark stored",
  benchmarkingFailed: "benchmarking failed",
} as const;

type LogLevel = "info" | "warn" | "error";

// Logging must never take down the run it is describing: a failed insert is
// reported to the task logger and swallowed. This is the one place an empty
// catch would be tempting — AGENTS.md forbids it, so the failure is surfaced.
export async function agentLog(
  service: SupabaseClient,
  {
    runId,
    stage,
    level = "info",
    message,
    payload,
  }: {
    runId: string;
    stage: string;
    level?: LogLevel;
    message: string;
    payload?: Record<string, unknown>;
  },
): Promise<void> {
  // try/catch as well as the returned error: a Supabase query error comes back
  // in `error`, but the request itself can still throw (network down, DNS,
  // aborted fetch), and that throw would escape into the caller. In the trigger
  // route that would surface as a 500 for a run that was committed and is
  // waiting for the sweeper — reviving the duplicate-run problem T-010 removed.
  try {
    const { error } = await service.from("agent_logs").insert({
      run_id: runId,
      stage,
      level,
      message,
      payload: payload ?? null,
    });

    if (error) {
      console.error("agent_logs insert failed", runId, message, error.message);
    }
  } catch (cause) {
    console.error(
      "agent_logs insert threw",
      runId,
      message,
      cause instanceof Error ? cause.message : String(cause),
    );
  }
}
