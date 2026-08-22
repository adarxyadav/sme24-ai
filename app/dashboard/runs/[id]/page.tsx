import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { KpiLedger } from "@/components/dashboard/KpiLedger";
import { RunStatusCard } from "@/components/dashboard/RunStatusCard";
import { buttonVariants } from "@/components/ui/button";
import { getRunKpis } from "@/lib/portal/kpis";
import { buildLedger } from "@/lib/portal/ledger";
import { runState } from "@/lib/portal/run-state";
import { getRunById } from "@/lib/portal/runs";

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

  const ledger =
    runState(run.status) === "completed"
      ? buildLedger(await getRunKpis(run.id))
      : null;

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
      {ledger && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-medium tracking-tight">KPI ledger</h2>
          <KpiLedger rows={ledger} />
        </section>
      )}
    </>
  );
}
