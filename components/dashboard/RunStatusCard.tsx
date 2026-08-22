import {
  CheckCircle2,
  Clock,
  Loader,
  SearchX,
  TimerOff,
  type LucideIcon,
} from "lucide-react";
import { RunStatusBadge } from "@/components/dashboard/RunStatusBadge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { runState, type RunState } from "@/lib/portal/run-state";
import type { Run } from "@/lib/portal/runs";
import { cn } from "@/lib/utils";

type StateBlock = { icon: LucideIcon; tone: string; title: string; body: string };

// Copy is fixed per state and reads nothing but the status: the read layer
// never selects `error`, so the failed notice is generic by construction
// (pipeline-rules.md: "a generic delayed notice, never the error").
const BLOCKS: Record<RunState, StateBlock> = {
  queued: {
    icon: Clock,
    tone: "text-primary",
    title: "Queued",
    body: "Your search is in the queue. We’ll research public disclosures and extract the safety KPIs with their sources.",
  },
  in_progress: {
    icon: Loader,
    tone: "text-primary",
    title: "In progress",
    body: "We’re researching public disclosures and extracting the safety KPIs with their sources. This usually takes a few minutes.",
  },
  completed: {
    icon: CheckCircle2,
    tone: "text-success",
    title: "Completed",
    body: "The KPI ledger below lists every figure with its source. A metric with no public disclosure is shown as not disclosed.",
  },
  no_data: {
    icon: SearchX,
    tone: "text-muted-foreground",
    title: "Nothing public found",
    body: "We found no EHS disclosures for this company and no figures were supplied. Run a new search with your own figures to get a ledger.",
  },
  failed: {
    icon: TimerOff,
    tone: "text-warning",
    title: "Delayed",
    body: "This analysis hit a problem on our side. It has been logged and we’ll look into it — please check back later.",
  },
};

export function RunStatusCard({ run }: { run: Run }) {
  const block = BLOCKS[runState(run.status)];
  const Icon = block.icon;

  return (
    <Card>
      <CardHeader>
        <CardDescription>Analysis</CardDescription>
        <CardTitle className="text-2xl">{run.company_name}</CardTitle>
        {run.company_domain && (
          <CardDescription>{run.company_domain}</CardDescription>
        )}
        <CardAction>
          <RunStatusBadge status={run.status} />
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-4">
          <Icon aria-hidden="true" className={cn("mt-0.5 size-5", block.tone)} />
          <div className="flex flex-col gap-1">
            <p className="font-medium">{block.title}</p>
            <p className="text-sm text-muted-foreground">{block.body}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
