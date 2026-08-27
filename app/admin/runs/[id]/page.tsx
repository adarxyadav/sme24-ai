import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AgentLogTable } from "@/components/admin/AgentLogTable";
import { RunStatusBadge } from "@/components/dashboard/RunStatusBadge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getRunDetail, listUsers } from "@/lib/admin/read";
import { requireAdmin } from "@/lib/admin/gate";

export const metadata: Metadata = { title: "Run — Admin — SME24", robots: { index: false, follow: false } };

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="grid grid-cols-3 gap-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="col-span-2 break-all">{value ?? "—"}</dd>
    </div>
  );
}

// The operator's view of one run: everything the client page hides
// (error, handle, cache key, upload path) and the pipeline's log.
export default async function AdminRunPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const [detail, users] = await Promise.all([getRunDetail(id), listUsers()]);
  if (!detail) notFound();
  const { run, logs, kpiCount } = detail;
  const owner = users.find((u) => u.id === run.user_id)?.email ?? run.user_id;

  return (
    <>
      <Link href="/admin/runs" className={buttonVariants({ variant: "ghost", size: "sm" })}>← Runs</Link>
      <Card>
        <CardHeader>
          <CardDescription>Run {run.id}</CardDescription>
          <CardTitle className="flex items-center gap-3 text-2xl">
            {run.company_name} <RunStatusBadge status={run.status} />
          </CardTitle>
          <CardDescription>
            {owner} · {run.processor} · {kpiCount} KPI rows
            {" · "}
            <Link href={`/dashboard/runs/${run.id}`} className="text-primary underline-offset-4 hover:underline">client view</Link>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="flex flex-col gap-2">
            <Row label="Domain" value={run.company_domain} />
            <Row label="Cache key" value={run.cache_key} />
            <Row label="Created" value={run.created_at} />
            <Row label="Completed" value={run.completed_at} />
            <Row label="Trigger.dev run" value={run.trigger_run_id} />
            <Row label="Uploaded report" value={run.uploaded_report_path} />
            <Row label="Error" value={run.error} />
          </dl>
        </CardContent>
      </Card>
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-medium tracking-tight">Agent log</h2>
        <AgentLogTable logs={logs} />
      </section>
    </>
  );
}
