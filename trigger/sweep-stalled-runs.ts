import { ApiError, logger, runs, schedules } from "@trigger.dev/sdk";
import { agentLog, LOG_MESSAGES } from "@/lib/runs/agent-log";
import { createServiceClient } from "@/lib/supabase/service";

// T-011 — the owner of every working status after `queued`.
//
// A task inside a working status writes the terminal itself — onFailure after
// exhausted retries, onCancel on cancellation — but neither hook fires for a
// crash, a system failure, or a worker that simply disappears (SDK docs), and
// a stage-1 retry that loses its own claim returns quietly (tickets.md,
// Later). Any of those leaves the row working forever with nothing to move it.
//
// No age threshold: a run may legitimately hold `researching` for the task's
// full maxDuration, and the row cannot tell a slow task from a dead one. So
// the sweeper asks Trigger.dev. Each working row names the run responsible
// for it (`trigger_run_id`, written inside the claim by both stages); one
// `runs.retrieve` per row says whether that run is still going.

const STAGE = "sweep";

// The SDK does not re-export its RunStatus enum; the retrieve result's own
// `status` is the same type, so the liveness map is exhaustive over it.
type RunStatus = Awaited<ReturnType<typeof runs.retrieve>>["status"];

// The statuses a task is supposed to be inside. Terminals are never selected,
// and `queued` has its own sweeper.
const WORKING_STATUSES = [
  "researching",
  "extracting",
  "benchmarking",
  "matching",
  "generating",
] as const;

// One page is far more than a healthy system holds in flight; a backlog above
// it drains over the next sweeps. At most this many API calls per tick.
const SWEEP_LIMIT = 100;

// Exhaustive over the SDK's enum, so a widened enum fails the build here
// rather than being filed silently (t-011-spec.md D2). "alive" means the run
// will still act on the row; "dead" means it returned or was ended and the
// row, still working, has lost its terminal write.
const LIVENESS: Record<RunStatus, "alive" | "dead"> = {
  PENDING_VERSION: "alive",
  QUEUED: "alive",
  DELAYED: "alive",
  DEQUEUED: "alive",
  EXECUTING: "alive",
  WAITING: "alive",
  COMPLETED: "dead",
  CANCELED: "dead",
  FAILED: "dead",
  CRASHED: "dead",
  SYSTEM_FAILURE: "dead",
  TIMED_OUT: "dead",
  EXPIRED: "dead",
};

function isKnownStatus(status: string): status is RunStatus {
  return status in LIVENESS;
}

type WorkingRun = {
  id: string;
  status: (typeof WORKING_STATUSES)[number];
  trigger_run_id: string | null;
  created_at: string;
};

type Verdict =
  | { kind: "alive"; status: RunStatus }
  | { kind: "dead"; status: RunStatus }
  | { kind: "unknown"; reason: string };

async function liveness(handle: string): Promise<Verdict> {
  try {
    const run = await runs.retrieve(handle);
    if (!isKnownStatus(run.status)) {
      return { kind: "unknown", reason: `unmapped status ${String(run.status)}` };
    }
    return { kind: LIVENESS[run.status], status: run.status };
  } catch (cause) {
    // Uncertainty never fails a run. A 404 in particular is what a run id
    // from another Trigger.dev environment looks like to this worker's key —
    // the database is shared, the environments are not — and that run may be
    // executing fine under the other key.
    const reason =
      cause instanceof ApiError
        ? `retrieve ${cause.status ?? "error"}: ${cause.message}`
        : cause instanceof Error
          ? cause.message
          : String(cause);
    return { kind: "unknown", reason: reason.slice(0, 500) };
  }
}

export const sweepStalledRunsTask = schedules.task({
  id: "sweep-stalled-runs",
  cron: { pattern: "*/5 * * * *", timezone: "UTC" },

  run: async () => {
    const service = createServiceClient();

    const { data: working, error: selectError } = await service
      .from("analysis_runs")
      .select("id, status, trigger_run_id, created_at")
      .in("status", [...WORKING_STATUSES])
      .order("created_at", { ascending: true })
      .limit(SWEEP_LIMIT)
      .returns<WorkingRun[]>();

    if (selectError) throw new Error(`stalled sweep select failed: ${selectError.message}`);

    const rows = working ?? [];
    if (rows.length === 0) return { checked: 0, terminated: 0, unknown: 0 };

    let terminated = 0;
    let unknown = 0;

    for (const run of rows) {
      // One run must never abandon the batch (same promise as the queued
      // sweeper): a thrown request here would leave every later row unswept.
      try {
        // A working row with no handle was never claimed by a task that writes
        // one — every path into a working status writes it in the same
        // statement — so nothing will ever move it.
        const verdict: Verdict =
          run.trigger_run_id === null
            ? { kind: "dead", status: "COMPLETED" }
            : await liveness(run.trigger_run_id);

        if (verdict.kind === "alive") continue;

        if (verdict.kind === "unknown") {
          await agentLog(service, {
            runId: run.id,
            stage: STAGE,
            level: "warn",
            message: LOG_MESSAGES.livenessUnknown,
            payload: { trigger_run_id: run.trigger_run_id, reason: verdict.reason },
          });
          unknown += 1;
          continue;
        }

        const reason = run.trigger_run_id === null ? "no_handle" : "task_dead";
        const errorText =
          reason === "no_handle"
            ? "Run has no task handle"
            : `Run's task ended ${verdict.status} without writing a terminal`;

        // The same terminal shape as the tasks' own hooks (pipeline-rules.md:
        // status + the error column + one agent_logs row). Guarded on both the
        // working statuses — a terminal written since the select must survive —
        // and the handle the verdict was about: if stage 2 claimed in between,
        // the row belongs to a run this sweep never asked about, and the update
        // must miss. Zero rows means nothing to log; the next sweep re-asks.
        let terminate = service
          .from("analysis_runs")
          .update({ status: "failed", error: errorText, completed_at: new Date().toISOString() })
          .eq("id", run.id)
          .in("status", [...WORKING_STATUSES]);
        terminate =
          run.trigger_run_id === null
            ? terminate.is("trigger_run_id", null)
            : terminate.eq("trigger_run_id", run.trigger_run_id);

        const { data: changed, error: failError } = await terminate
          .select("id")
          .maybeSingle<{ id: string }>();

        if (failError) {
          logger.error("stalled sweep terminate failed", { runId: run.id, message: failError.message });
          continue;
        }
        if (!changed) continue;

        await agentLog(service, {
          runId: run.id,
          stage: STAGE,
          level: "error",
          message: LOG_MESSAGES.sweptStalled,
          payload: {
            reason,
            observed_status: run.status,
            trigger_run_id: run.trigger_run_id,
            trigger_status: reason === "no_handle" ? null : verdict.status,
            working_since: run.created_at,
          },
        });

        terminated += 1;
      } catch (cause) {
        logger.error("stalled sweep item failed", {
          runId: run.id,
          message: cause instanceof Error ? cause.message : String(cause),
        });
      }
    }

    logger.log("stalled sweep complete", { checked: rows.length, terminated, unknown });
    return { checked: rows.length, terminated, unknown };
  },
});
