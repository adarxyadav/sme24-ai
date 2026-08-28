import { ExternalLink } from "lucide-react";
import {
  Table,
  TableBody,
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
    <span className="font-mono text-[13px] tabular-nums">
      {formatValue(value)}
      {basis && (
        <span className="ml-1 font-sans text-[11px] text-muted-foreground">
          {basis}
        </span>
      )}
    </span>
  );
}

// The rank strip: every ranked figure as position on one line — the company is
// the only emphasised mark. Position, never competing hues.
function RankStrip({
  company,
  rates,
  metric,
  rank,
  peerCount,
}: {
  company: number;
  rates: number[];
  metric: string;
  rank: number;
  peerCount: number;
}) {
  const max = Math.max(company, ...rates);
  const end = Math.ceil(max * 1.05 * 2) / 2 || 1;
  const left = (value: number) => `${(value / end) * 100}%`;

  return (
    <div
      className="px-5 pt-5"
      role="img"
      aria-label={`Ranked ${metric} figures on one axis; this company at ${formatValue(company)} is rank ${rank} of ${peerCount + 1}`}
    >
      <div className="relative h-3.5" aria-hidden="true">
        <span className="absolute inset-x-0 top-1/2 h-px bg-border" />
        {rates.map((rate, index) => (
          <i
            key={index}
            style={{ left: left(rate) }}
            className="absolute top-1/2 size-1.75 -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-muted-foreground bg-card"
          />
        ))}
        <i
          style={{ left: left(company) }}
          className="absolute top-1/2 size-2.25 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary"
        />
      </div>
      <div
        className="mt-1 flex justify-between font-mono text-[11px] text-muted-foreground tabular-nums"
        aria-hidden="true"
      >
        <span>0</span>
        <span>{formatValue(end)}</span>
      </div>
      <p className="mt-0.5 text-right text-[11px] text-muted-foreground">
        each mark — a ranked {metric} · filled — this company,{" "}
        {formatValue(company)} · left is lower
      </p>
    </div>
  );
}

// Chapter 2 of the report: the judgment as copy, the rank as position on one
// axis, the peers as a cited table. Every number is read from the stored peer
// list via the read layer; nothing is computed here beyond axis placement.
export function BenchmarkCard({ benchmark }: { benchmark: Benchmark }) {
  const { comparison } = benchmark;
  const references = comparison.references;
  const rates = benchmark.comparable_rates;
  const company = benchmark.rate_metric
    ? comparison.company[benchmark.rate_metric]
    : null;

  return (
    <div className="overflow-clip rounded-lg border border-border bg-card">
      <header className="flex items-baseline justify-between gap-4 px-5 pt-3.5">
        <h2 className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
          Peer benchmark
        </h2>
        {benchmark.maturity_label && (
          <span className="rounded-full border border-border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-primary">
            {MATURITY_DISPLAY[benchmark.maturity_label]}
          </span>
        )}
      </header>

      <div className={cn("px-5 pt-1.5", benchmark.insufficient && "pb-4")}>
        <p
          className={cn(
            "text-xl font-medium tracking-tight",
            benchmark.insufficient && "text-lg text-muted-foreground",
          )}
        >
          {benchmark.insufficient
            ? "Insufficient benchmark data"
            : benchmark.rank !== null && benchmark.rate_metric
              ? `Rank ${benchmark.rank} of ${benchmark.peer_count + 1} on ${benchmark.rate_metric}`
              : "No comparable peer rate"}
        </p>
        <p className="mt-1.5 max-w-176 text-xs text-muted-foreground">
          {benchmark.insufficient
            ? "No peer in this sector discloses a comparable injury rate and no sector reference is published, so the company cannot be placed. The KPI ledger and incident cost stand on their own."
            : benchmark.rank !== null
              ? "Rank 1 is the lowest rate. Ranked only against peers disclosing the same metric on the same basis (per 1'000'000 hours worked); nothing is converted."
              : "The company and its peers do not share a rate on the same basis, so no rank is given; the references and the peer table below still apply."}
        </p>
      </div>

      {!benchmark.insufficient && (
        <>
          {benchmark.rank !== null && benchmark.rate_metric && company && (
            <RankStrip
              company={company.value}
              rates={rates}
              metric={benchmark.rate_metric}
              rank={benchmark.rank}
              peerCount={benchmark.peer_count}
            />
          )}

          {benchmark.verdict && (
            <div className="mx-5 mt-4 rounded-md border border-border bg-muted/40 px-4 py-3.5">
              <p className="font-medium">{benchmark.verdict}</p>
              {benchmark.maturity_rationale && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {benchmark.maturity_rationale}
                </p>
              )}
            </div>
          )}

          {references && (
            <dl className="mt-4 grid grid-cols-2 justify-start gap-x-10 gap-y-2 px-5 sm:grid-cols-[repeat(3,auto)]">
              <div>
                <dt className="text-xs text-muted-foreground">
                  Sector median {references.metric}
                </dt>
                <dd className="font-medium tabular-nums">
                  {references.median !== null
                    ? formatValue(references.median)
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  Best in class {references.metric}
                </dt>
                <dd className="font-medium tabular-nums">
                  {references.best_in_class !== null
                    ? formatValue(references.best_in_class)
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  Reference source
                </dt>
                <dd className="font-medium">
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
            <div className="mt-4 border-t border-border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="px-4 py-2.5 pl-5 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                      Peer
                    </TableHead>
                    <TableHead className="px-4 py-2.5 text-right text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                      TRIR
                    </TableHead>
                    <TableHead className="px-4 py-2.5 text-right text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                      LTIFR
                    </TableHead>
                    <TableHead className="px-4 py-2.5 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                      Year
                    </TableHead>
                    <TableHead className="px-4 py-2.5 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                      Scope
                    </TableHead>
                    <TableHead className="px-4 py-2.5 pr-5 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                      Source
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comparison.peers.map((peer) => (
                    <TableRow
                      key={`${peer.company_name}-${peer.reporting_year ?? ""}`}
                      className={cn(
                        "hover:bg-accent/50",
                        !peer.comparable && "text-muted-foreground",
                      )}
                    >
                      <TableCell className="px-4 py-3 pl-5 align-baseline whitespace-normal">
                        <span
                          className={cn(
                            "font-medium",
                            !peer.comparable && "font-normal",
                          )}
                        >
                          {peer.company_name}
                        </span>
                        <span className="block text-[11px] text-muted-foreground">
                          {peer.country ?? ""}
                          {!peer.comparable && (peer.country ? " · " : "")}
                          {!peer.comparable && "not ranked"}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right align-baseline whitespace-normal">
                        <Rate value={peer.trir} basis={peer.trir_basis} />
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right align-baseline whitespace-normal">
                        <Rate value={peer.ltifr} basis={peer.ltifr_basis} />
                      </TableCell>
                      <TableCell className="px-4 py-3 align-baseline text-muted-foreground tabular-nums">
                        {peer.reporting_year ?? "—"}
                      </TableCell>
                      <TableCell className="px-4 py-3 align-baseline text-muted-foreground">
                        {peer.scope ?? "—"}
                      </TableCell>
                      <TableCell className="px-4 py-3 pr-5 align-baseline">
                        {peer.source_url ? (
                          <a
                            href={peer.source_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                          >
                            {hostname(peer.source_url)}
                            <ExternalLink
                              aria-hidden="true"
                              className="size-3"
                            />
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
            </div>
          )}

          <footer className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
            Peer figures as each peer disclosed them; a peer on another basis is
            listed but not ranked.
          </footer>
        </>
      )}
    </div>
  );
}
