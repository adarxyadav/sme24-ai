import Link from "next/link";
import type { Metadata } from "next";
import { RunList } from "@/components/dashboard/RunList";
import { buttonVariants } from "@/components/ui/button";
import { listRuns } from "@/lib/portal/runs";

export const metadata: Metadata = {
  title: "Your analyses — SME24",
  robots: { index: false, follow: false },
};

// The proxy gates this path on a session; RLS then scopes the list to the
// caller's own runs, so the page holds no user id and no ownership check.
export default async function RunListPage() {
  const runs = await listRuns();

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-medium tracking-tight">Your analyses</h1>
          <p className="text-muted-foreground">
            Every search you have run, newest first.
          </p>
        </div>
        <Link href="/dashboard" className={buttonVariants()}>
          New search
        </Link>
      </header>
      <RunList runs={runs} />
    </>
  );
}
