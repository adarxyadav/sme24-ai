import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { BenchmarkCard } from "@/components/dashboard/BenchmarkCard";
import { ExpertMatchesCard } from "@/components/dashboard/ExpertMatchesCard";
import { ProposalCard } from "@/components/dashboard/ProposalCard";
import { IncidentCostCard } from "@/components/dashboard/IncidentCostCard";
import { KpiLedger } from "@/components/dashboard/KpiLedger";
import { RunProgress } from "@/components/dashboard/RunProgress";
import { RunStatusCard } from "@/components/dashboard/RunStatusCard";
import { buttonVariants } from "@/components/ui/button";
import { getRunBenchmark } from "@/lib/portal/benchmark";
import { buildIncidentCost } from "@/lib/portal/incident-cost";
import { getRunMatches } from "@/lib/portal/matches";
import { getRunProposal } from "@/lib/portal/proposal";
import { getRunKpis } from "@/lib/portal/kpis";
import { buildLedger, deriveFigures } from "@/lib/portal/ledger";
import { runState } from "@/lib/portal/run-state";
import { getRunById, getRunHeadcount } from "@/lib/portal/runs";

export const metadata: Metadata = { robots: { index: false, follow: false } };

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
  const kpis = state === "completed" ? await getRunKpis(run.id) : null;
  const headcount = kpis ? await getRunHeadcount(run.id) : null;
  const derived = kpis ? deriveFigures(kpis, headcount) : null;
  const ledger = kpis && derived ? buildLedger(kpis, derived) : null;
  const cost = kpis && derived ? buildIncidentCost(kpis, derived) : null;
  // Runs completed before stage 3 existed have no row and show no card.
  const benchmark = kpis ? await getRunBenchmark(run.id) : null;
  // Shown only once a run has a benchmark row, i.e. went through stage 3+.
  const matches = benchmark ? await getRunMatches(run.id) : null;
  const proposal = benchmark ? await getRunProposal(run.id) : null;
  const live = state === "queued" || state === "in_progress";

  return (
    <>
      <Link
        href="/dashboard"
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        <ArrowLeft aria-hidden="true" />
        Your analyses
      </Link>
      <RunStatusCard run={run} />
      {live && <RunProgress />}
      {ledger && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-medium tracking-tight">KPI ledger</h2>
          <KpiLedger rows={ledger} />
        </section>
      )}
      {kpis && <IncidentCostCard cost={cost} />}
      {benchmark && <BenchmarkCard benchmark={benchmark} />}
      {proposal && <ProposalCard proposal={proposal} />}
      {matches && <ExpertMatchesCard matches={matches} />}
    </>
  );
}
