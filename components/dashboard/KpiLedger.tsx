import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Confidence, KpiRow } from "@/lib/portal/kpis";
import {
  CANONICAL_METRICS,
  formatValue,
  type LedgerRow,
} from "@/lib/portal/ledger";
import { cn } from "@/lib/utils";

const CONFIDENCE_CLASSES: Record<Confidence, string> = {
  high: "text-success",
  medium: "text-warning",
  low: "text-muted-foreground",
};

const CONFIDENCE_LABELS: Record<Confidence, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

// Mobile (< md): the ledger stacks each metric into two quiet lines instead of
// scrolling sideways (design-report-page.html, mobile convention). The grid
// areas below carry that layout; desktop keeps the table grammar.
const ROW_AREAS =
  "max-md:grid max-md:grid-cols-[1fr_auto] max-md:items-baseline max-md:gap-x-4 max-md:px-5 max-md:py-3 max-md:[grid-template-areas:'m_v'_'s_s'_'c_c']";

function ConfidenceDot({ confidence }: { confidence: Confidence }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs before:size-1.5 before:rounded-full before:bg-current before:content-['']",
        CONFIDENCE_CLASSES[confidence],
      )}
    >
      {CONFIDENCE_LABELS[confidence]}
    </span>
  );
}

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
      <>
        <span className="text-muted-foreground">Uploaded report</span>
        {kpi.source_excerpt && (
          <q className="mt-0.5 block truncate text-xs text-muted-foreground">
            {kpi.source_excerpt}
          </q>
        )}
      </>
    );
  }
  if (!kpi.source_url) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <>
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
        <q className="mt-0.5 block truncate text-xs text-muted-foreground">
          {kpi.source_excerpt}
        </q>
      )}
    </>
  );
}

// Chapter 1 of the report: the ledger as one card — header with the seven-tick
// disclosure meter, the provenance table, one consequence footer.
export function KpiLedger({ rows }: { rows: LedgerRow[] }) {
  const byMetric = new Map(rows.map((row) => [row.metric, row]));
  const filled = CANONICAL_METRICS.filter(
    (metric) => byMetric.get(metric)?.kpi?.value != null,
  );
  const periods = [
    ...new Set(
      rows.flatMap((row) =>
        row.kpi?.value != null && row.kpi.period ? [row.kpi.period] : [],
      ),
    ),
  ];

  return (
    <div className="overflow-clip rounded-lg border border-border bg-card">
      <header className="flex items-center justify-between gap-4 border-b border-border px-5 py-3.5">
        <div className="flex min-w-0 items-baseline gap-2.5">
          <h2 className="text-sm font-semibold tracking-tight">KPI ledger</h2>
          {periods.length === 1 && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {periods[0]}
            </span>
          )}
        </div>
        <div
          className="flex flex-none items-center gap-2"
          role="img"
          aria-label={`${filled.length} of ${CANONICAL_METRICS.length} metrics have a disclosed or supplied value`}
        >
          <span className="flex gap-1" aria-hidden="true">
            {CANONICAL_METRICS.map((metric) => (
              <i
                key={metric}
                className={cn(
                  "h-0.75 w-3 rounded-full bg-border",
                  byMetric.get(metric)?.kpi?.value != null && "bg-primary",
                )}
              />
            ))}
          </span>
          <span className="text-xs text-muted-foreground tabular-nums">
            <b className="font-medium text-foreground">{filled.length}</b>/
            {CANONICAL_METRICS.length}
          </span>
        </div>
      </header>

      <Table className="max-md:block max-md:[&_tbody]:block">
        <TableHeader className="max-md:hidden">
          <TableRow className="hover:bg-transparent">
            <TableHead className="px-4 py-2.5 pl-5 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
              Metric
            </TableHead>
            <TableHead className="px-4 py-2.5 text-right text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
              Value
            </TableHead>
            <TableHead className="px-4 py-2.5 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
              Period
            </TableHead>
            <TableHead className="px-4 py-2.5 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
              Confidence
            </TableHead>
            <TableHead className="px-4 py-2.5 pr-5 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
              Source
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ metric, label, hint, kpi, derived }) => {
            const empty = kpi?.value == null && !derived;
            return (
              <TableRow
                key={metric}
                className={cn("hover:bg-accent/50", ROW_AREAS)}
              >
                <TableCell
                  className={cn(
                    "px-4 py-3.5 pl-5 align-baseline whitespace-normal",
                    "max-md:p-0 max-md:[grid-area:m]",
                  )}
                >
                  <span
                    className={cn(
                      "font-medium",
                      empty && "font-normal text-muted-foreground",
                    )}
                  >
                    {label}
                  </span>
                  <span className="ml-2 text-xs text-muted-foreground max-md:mt-px max-md:ml-0 max-md:block">
                    {hint}
                  </span>
                </TableCell>
                <TableCell
                  className={cn(
                    "px-4 py-3.5 text-right align-baseline font-mono text-[13px] whitespace-normal tabular-nums",
                    "max-md:p-0 max-md:text-right max-md:[grid-area:v]",
                  )}
                >
                  {kpi?.value != null ? (
                    <>
                      {formatValue(kpi.value)}
                      {kpi.unit && (
                        <span className="ml-1 text-[11px] text-muted-foreground">
                          {kpi.unit}
                        </span>
                      )}
                    </>
                  ) : derived ? (
                    <>
                      ≈ {formatValue(derived.value)}
                      <span className="block font-mono text-[11px] text-muted-foreground">
                        {derived.formula}
                      </span>
                    </>
                  ) : (
                    <span className="font-sans text-muted-foreground">
                      Not disclosed
                    </span>
                  )}
                </TableCell>
                <TableCell className="px-4 py-3.5 align-baseline text-muted-foreground tabular-nums max-md:hidden">
                  {kpi?.period ?? "—"}
                </TableCell>
                <TableCell
                  className={cn(
                    "px-4 py-3.5 align-baseline",
                    "max-md:p-0 max-md:pt-1 max-md:[grid-area:c]",
                  )}
                >
                  {kpi?.value != null ? (
                    <ConfidenceDot confidence={kpi.confidence} />
                  ) : derived ? (
                    <Badge variant="outline" className="text-muted-foreground">
                      derived
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell
                  className={cn(
                    "max-w-88 px-4 py-3.5 pr-5 align-baseline whitespace-normal",
                    "max-md:min-w-0 max-md:max-w-none max-md:p-0 max-md:pt-1 max-md:[grid-area:s]",
                  )}
                >
                  {kpi?.value != null ? (
                    <Source kpi={kpi} />
                  ) : derived ? (
                    <span className="text-muted-foreground">
                      Derived from {derived.inputs}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <footer className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-border px-5 py-3 text-xs text-muted-foreground">
        <span>
          Copied from cited disclosures or supplied by you. Nothing is
          estimated.
        </span>
        <span className="font-mono text-[11px]">≈ derived at display time</span>
      </footer>
    </div>
  );
}
