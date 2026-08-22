import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MATURITY_DISPLAY, type Benchmark } from "@/lib/portal/benchmark";
import { formatValue } from "@/lib/portal/ledger";
import { cn } from "@/lib/utils";

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function Rate({ value, basis }: { value: number | null; basis: string | null }) {
  if (value === null) return <span className="text-muted-foreground">—</span>;
  return (
    <>
      <span className="font-medium">{formatValue(value)}</span>
      {basis && <span className="ml-1 text-xs text-muted-foreground">{basis}</span>}
    </>
  );
}

// Stage 3 on the report: the judgment as copy, the rank as "n of N", the
// peers as a cited table. Every number is read from the stored peer list via
// the read layer; nothing is computed here.
export function BenchmarkCard({ benchmark }: { benchmark: Benchmark }) {
  const { comparison } = benchmark;
  const references = comparison.references;

  return (
    <Card>
      <CardHeader>
        <CardDescription>Peer benchmark</CardDescription>
        <CardTitle className="text-2xl">
          {benchmark.insufficient
            ? "Insufficient benchmark data"
            : benchmark.rank !== null && benchmark.rate_metric
              ? `Rank ${benchmark.rank} of ${benchmark.peer_count + 1} on ${benchmark.rate_metric}`
              : "No comparable peer rate"}
        </CardTitle>
        <CardDescription>
          {benchmark.insufficient
            ? "No peer in this sector discloses a comparable injury rate and no sector reference is published, so the company cannot be placed. The KPI ledger and incident cost above stand on their own."
            : benchmark.rank !== null
              ? "Rank 1 is the lowest rate. Ranked only against peers disclosing the same metric on the same basis (per 1'000'000 hours worked); nothing is converted."
              : "The company and its peers do not share a rate on the same basis, so no rank is given; the references and the peer table below still apply."}
        </CardDescription>
        {benchmark.maturity_label && (
          <CardAction>
            <Badge variant="outline" className="text-primary">
              {MATURITY_DISPLAY[benchmark.maturity_label]}
            </Badge>
          </CardAction>
        )}
      </CardHeader>
      {!benchmark.insufficient && (
        <CardContent className="flex flex-col gap-6">
          {benchmark.verdict && (
            <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-4">
              <p className="font-medium">{benchmark.verdict}</p>
              {benchmark.maturity_rationale && (
                <p className="text-sm text-muted-foreground">{benchmark.maturity_rationale}</p>
              )}
            </div>
          )}
          {references && (
            <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-muted-foreground">Sector median {references.metric}</dt>
                <dd className="tabular-nums font-medium">
                  {references.median !== null ? formatValue(references.median) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Best in class {references.metric}</dt>
                <dd className="tabular-nums font-medium">
                  {references.best_in_class !== null ? formatValue(references.best_in_class) : "—"}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-muted-foreground">Reference source</dt>
                <dd>
                  {references.source_url ? (
                    <a
                      href={references.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                    >
                      {hostname(references.source_url)}
                      <ExternalLink aria-hidden="true" className="size-3" />
                      <span className="sr-only">(opens in a new tab)</span>
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
            </dl>
          )}
          {comparison.peers.length > 0 && (
            <Table>
              <TableCaption>
                Peer figures as each peer disclosed them; a peer on another basis is listed but not ranked.
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Peer</TableHead>
                  <TableHead className="text-right">TRIR</TableHead>
                  <TableHead className="text-right">LTIFR</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comparison.peers.map((peer) => (
                  <TableRow
                    key={`${peer.company_name}-${peer.reporting_year ?? ""}`}
                    className={cn(!peer.comparable && "text-muted-foreground")}
                  >
                    <TableCell>
                      <div className="font-medium">{peer.company_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {peer.country ?? ""}
                        {!peer.comparable && (peer.country ? " · " : "")}
                        {!peer.comparable && "not ranked"}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <Rate value={peer.trir} basis={peer.trir_basis} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <Rate value={peer.ltifr} basis={peer.ltifr_basis} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{peer.reporting_year ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{peer.scope ?? "—"}</TableCell>
                    <TableCell>
                      {peer.source_url ? (
                        <a
                          href={peer.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                        >
                          {hostname(peer.source_url)}
                          <ExternalLink aria-hidden="true" className="size-3" />
                          <span className="sr-only">(opens in a new tab)</span>
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      )}
    </Card>
  );
}
