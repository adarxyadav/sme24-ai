import Link from "next/link";
import { RunStatusBadge } from "@/components/dashboard/RunStatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AdminRun } from "@/lib/admin/read";

const dateFormat = new Intl.DateTimeFormat("de-CH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Zurich",
});

// Every run, with its owner's email resolved by the page from
// admin_list_users(); the status badge is the dashboard's.
export function AdminRunTable({
  runs,
  emails,
}: {
  runs: AdminRun[];
  emails: Map<string, string>;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Company</TableHead>
          <TableHead>Owner</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Tier</TableHead>
          <TableHead>Started</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {runs.map((run) => (
          <TableRow key={run.id}>
            <TableCell>
              <Link href={`/admin/runs/${run.id}`} className="font-medium text-primary underline-offset-4 hover:underline">
                {run.company_name}
              </Link>
              {run.company_domain && <div className="text-xs text-muted-foreground">{run.company_domain}</div>}
            </TableCell>
            <TableCell className="text-muted-foreground">{emails.get(run.user_id) ?? run.user_id.slice(0, 8)}</TableCell>
            <TableCell><RunStatusBadge status={run.status} /></TableCell>
            <TableCell className="text-muted-foreground">{run.processor}</TableCell>
            <TableCell className="text-muted-foreground">{dateFormat.format(new Date(run.created_at))}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
