import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { RunStatusCard } from "@/components/dashboard/RunStatusCard";
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

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-16 sm:px-6">
      <RunStatusCard run={run} />
    </section>
  );
}
