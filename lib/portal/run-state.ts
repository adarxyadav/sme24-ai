import type { RunStatus } from "@/lib/portal/runs";

// Five render states over the nine-value run_status enum. The Record is
// exhaustive, so adding an enum value without mapping it fails the build. The
// three stage-3–5 statuses are in progress from the client's point of view
// until a later ticket gives them their own states.
export type RunState =
  | "queued"
  | "in_progress"
  | "completed"
  | "no_data"
  | "failed";

const STATE_BY_STATUS: Record<RunStatus, RunState> = {
  queued: "queued",
  researching: "in_progress",
  extracting: "in_progress",
  benchmarking: "in_progress",
  matching: "in_progress",
  generating: "in_progress",
  completed: "completed",
  no_data: "no_data",
  failed: "failed",
};

export const RUN_STATE_LABELS: Record<RunState, string> = {
  queued: "Queued",
  in_progress: "In progress",
  completed: "Completed",
  no_data: "Nothing public found",
  failed: "Delayed",
};

export function runState(status: RunStatus): RunState {
  return STATE_BY_STATUS[status];
}
