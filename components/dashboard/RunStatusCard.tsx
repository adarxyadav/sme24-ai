import { Clock } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Run } from "@/lib/portal/runs";

// T-003 renders the queued state only — nothing can advance a run until the
// stage-1 task exists (T-004), so there is no polling and no realtime here.
// T-006 owns the remaining states and extends this component.
export function RunStatusCard({ run }: { run: Run }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>Analysis</CardDescription>
        <CardTitle className="text-2xl">{run.company_name}</CardTitle>
        {run.company_domain && (
          <CardDescription>{run.company_domain}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-4">
          <Clock aria-hidden="true" className="mt-0.5 size-5 text-primary" />
          <div className="flex flex-col gap-1">
            <p className="font-medium">Queued</p>
            <p className="text-sm text-muted-foreground">
              Your search is in the queue. We&rsquo;ll research public
              disclosures and extract the safety KPIs with their sources.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
