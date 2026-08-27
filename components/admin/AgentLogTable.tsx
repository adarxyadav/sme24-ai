import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AgentLogRow } from "@/lib/admin/read";
import { cn } from "@/lib/utils";

const LEVEL_CLASSES: Record<AgentLogRow["level"], string> = {
  info: "text-muted-foreground",
  warn: "text-warning",
  error: "text-destructive",
};

// The pipeline's own account of a run, in order. Payloads are shown raw:
// this is the operator's view, and the messages are the contract.
export function AgentLogTable({ logs }: { logs: AgentLogRow[] }) {
  if (logs.length === 0) {
    return <p className="text-sm text-muted-foreground">No log rows for this run.</p>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Time</TableHead>
          <TableHead>Stage</TableHead>
          <TableHead>Level</TableHead>
          <TableHead>Message</TableHead>
          <TableHead className="w-1/2">Payload</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {logs.map((log) => (
          <TableRow key={log.id}>
            <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">
              {log.created_at.slice(11, 19)}
            </TableCell>
            <TableCell>{log.stage}</TableCell>
            <TableCell>
              <Badge variant="outline" className={cn(LEVEL_CLASSES[log.level])}>{log.level}</Badge>
            </TableCell>
            <TableCell className="font-medium">{log.message}</TableCell>
            <TableCell className="whitespace-normal">
              <code className="block max-h-40 overflow-auto text-xs text-muted-foreground">
                {log.payload ? JSON.stringify(log.payload) : "—"}
              </code>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
