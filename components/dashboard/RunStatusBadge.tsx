import { Badge } from "@/components/ui/badge";
import { RUN_STATE_LABELS, runState, type RunState } from "@/lib/portal/run-state";
import type { RunStatus } from "@/lib/portal/runs";
import { cn } from "@/lib/utils";

const STATE_CLASSES: Record<RunState, string> = {
  queued: "text-primary",
  in_progress: "text-primary",
  completed: "text-success",
  no_data: "text-muted-foreground",
  failed: "text-warning",
};

// One label and one token per state, shared by the run list and the detail
// card so the two surfaces cannot disagree.
export function RunStatusBadge({ status }: { status: RunStatus }) {
  const state = runState(status);
  return (
    <Badge variant="outline" className={cn(STATE_CLASSES[state])}>
      {RUN_STATE_LABELS[state]}
    </Badge>
  );
}
