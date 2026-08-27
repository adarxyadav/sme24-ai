import Link from "next/link";
import { RunStatusBadge } from "@/components/dashboard/RunStatusBadge";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Run } from "@/lib/portal/runs";

const dateFormat = new Intl.DateTimeFormat("de-CH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Zurich",
});

export function RunList({ runs }: { runs: Run[] }) {
  if (runs.length === 0) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-xl border border-border p-6">
        <p className="text-muted-foreground">
          No analyses yet. Start one with your company name.
        </p>
        <Link href="/dashboard" className={buttonVariants()}>
          New search
        </Link>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Company</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Started</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {runs.map((run) => (
          <TableRow key={run.id}>
            <TableCell>
              <Link
                href={`/dashboard/runs/${run.id}`}
                className="font-medium underline-offset-4 hover:underline"
              >
                {run.company_name}
              </Link>
              {run.company_domain && (
                <span className="ml-2 text-muted-foreground">
                  {run.company_domain}
                </span>
              )}
            </TableCell>
            <TableCell>
              <RunStatusBadge status={run.status} />
            </TableCell>
            <TableCell className="text-muted-foreground">
              {dateFormat.format(new Date(run.created_at))}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
