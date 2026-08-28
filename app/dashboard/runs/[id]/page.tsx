import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BenchmarkCard } from "@/components/dashboard/BenchmarkCard";
import { ChapterRule } from "@/components/dashboard/ChapterRule";
import { ExpertMatchesCard } from "@/components/dashboard/ExpertMatchesCard";
import { FindingsStrip, type Finding } from "@/components/dashboard/FindingsStrip";
import { ProposalCard } from "@/components/dashboard/ProposalCard";
import { IncidentCostCard } from "@/components/dashboard/IncidentCostCard";
import { KpiLedger } from "@/components/dashboard/KpiLedger";
import { RunProgress } from "@/components/dashboard/RunProgress";
import { RunStatusCard } from "@/components/dashboard/RunStatusCard";
import { getRunBenchmark } from "@/lib/portal/benchmark";
import { buildIncidentCost, formatChfRange, formatChf } from "@/lib/portal/incident-cost";
import { getRunMatches } from "@/lib/portal/matches";
import { getRunProposal } from "@/lib/portal/proposal";
import { getRunKpis } from "@/lib/portal/kpis";
import {
  buildLedger,
  CANONICAL_METRICS,
  deriveFigures,
} from "@/lib/portal/ledger";
import { runState } from "@/lib/portal/run-state";
import { getRunById, getRunHeadcount } from "@/lib/portal/runs";

export const metadata: Metadata = { robots: { index: false, follow: false } };

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function ordinal(n: number): string {
  const rest = n % 100;
  const suffix =
    rest >= 11 && rest <= 13
      ? "th"
      : (["th", "st", "nd", "rd"][n % 10] ?? "th");
  return `${n}${suffix}`;
}

const COUNT_WORDS = ["No", "One", "Two", "Three"] as const;

// A run someone else owns is not found, not forbidden: RLS returns no row, and
// the page never learns whether the id exists.
export default async function RunPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const run = await getRunById(id);
  if (!run) notFound();

  const state = runState(run.status);

  if (state !== "completed") {
    return (
      <>
        <RunStatusCard run={run} />
        {(state === "queued" || state === "in_progress") && <RunProgress />}
      </>
    );
  }

  const [kpis, headcount, benchmark] = await Promise.all([
    getRunKpis(run.id),
    getRunHeadcount(run.id),
    getRunBenchmark(run.id),
  ]);
  const derived = deriveFigures(kpis, headcount);
  const ledger = buildLedger(kpis, derived);
  const cost = buildIncidentCost(kpis, derived);
  // Runs completed before stage 3 existed have no benchmark row and show
  // neither it nor the stage 4/5 sections.
  const [matches, proposal] = benchmark
    ? await Promise.all([getRunMatches(run.id), getRunProposal(run.id)])
    : [null, null];

  const filled = ledger.filter((row) => row.kpi?.value != null).length;
  const meta = [
    run.company_domain,
    benchmark?.comparison.industry.nace_label,
    dateFormat.format(new Date(run.created_at)),
  ].filter(Boolean);

  const findings: Finding[] = [
    {
      href: "#ledger",
      label: "KPI ledger",
      value: `${filled} of ${CANONICAL_METRICS.length} disclosed`,
      dim: filled === 0,
    },
    {
      href: benchmark ? "#benchmark" : undefined,
      label: "Peer benchmark",
      value: benchmark
        ? benchmark.insufficient
          ? "Insufficient data"
          : benchmark.rank !== null
            ? `Rank ${benchmark.rank} of ${benchmark.peer_count + 1}`
            : "No comparable rate"
        : "—",
      dim: !benchmark || benchmark.insufficient || benchmark.rank === null,
    },
    {
      href: "#cost",
      label: "Incident cost",
      value: cost ? formatChfRange(cost.min, cost.max) : "Cannot be estimated",
      dim: !cost,
    },
    {
      href: matches ? "#experts" : undefined,
      label: "Matched experts",
      value: matches ? `${matches.length} matched` : "—",
      dim: !matches || matches.length === 0,
    },
    {
      href: proposal ? "#proposal" : undefined,
      label: "Proposal",
      value: proposal
        ? `Tier ${proposal.tier.number}${
            proposal.tier.priceChf !== null
              ? ` · ${formatChf(proposal.tier.priceChf)}`
              : ""
          }`
        : "—",
      dim: !proposal,
    },
  ];

  // The lead: the report's abstract as deterministic prose — every figure is
  // the strip's own value restated, a fact that does not exist drops its
  // sentence, and derived money keeps the ≈ grammar (T-040).
  const lead = [
    `${run.company_name} discloses ${
      filled === 0 ? "none" : filled
    } of the ${CANONICAL_METRICS.length} core safety indicators.`,
    benchmark && benchmark.rank !== null && benchmark.rate_metric
      ? `On ${benchmark.rate_metric} it ranks ${ordinal(benchmark.rank)} of ${
          benchmark.peer_count + 1
        } comparable companies.`
      : null,
    cost
      ? `The incidents on record cost ≈ ${formatChfRange(cost.min, cost.max)} a year.`
      : null,
    matches && matches.length > 0
      ? `${COUNT_WORDS[matches.length] ?? matches.length} expert${
          matches.length === 1 ? " matches" : "s match"
        } its risk profile${
          proposal
            ? `; the report closes with a Tier ${proposal.tier.number} proposal`
            : ""
        }.`
      : proposal
        ? `The report closes with a Tier ${proposal.tier.number} proposal.`
        : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article className="flex flex-col gap-10">
      <header>
        <p className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
          SME24 · Safety report
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          {run.company_name}
        </h1>
        {meta.length > 0 && (
          <p className="mt-1 text-xs text-muted-foreground tabular-nums">
            {meta.join(" · ")}
          </p>
        )}
        <p className="mt-4 max-w-176 text-[15px] leading-relaxed tabular-nums">
          {lead}
        </p>
        <FindingsStrip findings={findings} />
      </header>

      <section id="ledger" className="flex scroll-mt-6 flex-col gap-3">
        <ChapterRule n={1} title="What the public record shows" />
        <KpiLedger rows={ledger} />
      </section>

      {benchmark && (
        <section id="benchmark" className="flex scroll-mt-6 flex-col gap-3">
          <ChapterRule n={2} title="Where it stands among peers" />
          <BenchmarkCard benchmark={benchmark} />
        </section>
      )}

      <section id="cost" className="flex scroll-mt-6 flex-col gap-3">
        <ChapterRule n={3} title="What those incidents cost each year" />
        <IncidentCostCard cost={cost} />
      </section>

      {matches && (
        <section id="experts" className="flex scroll-mt-6 flex-col gap-3">
          <ChapterRule n={4} title="Who can close the gap" />
          <ExpertMatchesCard matches={matches} />
        </section>
      )}

      {proposal && (
        <section id="proposal" className="flex scroll-mt-6 flex-col gap-3">
          <ChapterRule n={5} title="What we propose" />
          <ProposalCard proposal={proposal} />
        </section>
      )}

      <p className="max-w-176 text-xs text-muted-foreground">
        Every figure above carries its provenance — copied from a cited
        disclosure, supplied by you, or derived in code and marked ≈. Nothing
        is estimated.
      </p>
    </article>
  );
}
