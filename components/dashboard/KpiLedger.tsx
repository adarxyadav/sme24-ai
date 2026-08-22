import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Confidence, KpiRow } from "@/lib/portal/kpis";
import { formatValue, type LedgerRow } from "@/lib/portal/ledger";
import { cn } from "@/lib/utils";

const CONFIDENCE_CLASSES: Record<Confidence, string> = {
  high: "text-success",
  medium: "text-warning",
  low: "text-muted-foreground",
};

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// The provenance slot: a client figure has no URL and no excerpt, and the
// "Client-provided" marker is what stands in for them (kpi-contract.md, Show).
function Source({ kpi }: { kpi: KpiRow }) {
  if (kpi.origin === "client") {
    return <span className="text-muted-foreground">Client-provided</span>;
  }
  if (kpi.origin === "upload") {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-muted-foreground">Uploaded report</span>
        {kpi.source_excerpt && (
          <q className="line-clamp-3 text-xs text-muted-foreground">{kpi.source_excerpt}</q>
        )}
      </div>
    );
  }
  if (!kpi.source_url) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <div className="flex flex-col gap-1">
      <a
        href={kpi.source_url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
      >
        {hostname(kpi.source_url)}
        <ExternalLink aria-hidden="true" className="size-3" />
        <span className="sr-only">(opens in a new tab)</span>
      </a>
      {kpi.source_excerpt && (
        <q className="line-clamp-3 text-xs text-muted-foreground">
          {kpi.source_excerpt}
        </q>
      )}
    </div>
  );
}

export function KpiLedger({ rows }: { rows: LedgerRow[] }) {
  return (
    <Table>
      <TableCaption>
        Figures are copied from the cited disclosure or supplied by you; nothing
        is estimated.
      </TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Metric</TableHead>
          <TableHead className="text-right">Value</TableHead>
          <TableHead>Period</TableHead>
          <TableHead>Confidence</TableHead>
          <TableHead className="w-2/5">Source</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(({ metric, label, hint, kpi }) => (
          <TableRow key={metric}>
            <TableCell>
              <div className="font-medium">{label}</div>
              <div className="text-xs text-muted-foreground">{hint}</div>
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {kpi?.value !== null && kpi?.value !== undefined ? (
                <>
                  <span className="font-medium">{formatValue(kpi.value)}</span>
                  {kpi.unit && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      {kpi.unit}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-muted-foreground">Not disclosed</span>
              )}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {kpi?.period ?? "—"}
            </TableCell>
            <TableCell>
              {kpi ? (
                <Badge
                  variant="outline"
                  className={cn(CONFIDENCE_CLASSES[kpi.confidence])}
                >
                  {kpi.confidence}
                </Badge>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell className="align-top whitespace-normal">
              {kpi ? (
                <Source kpi={kpi} />
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
