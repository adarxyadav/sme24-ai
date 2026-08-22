import type { Metadata } from "next";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getOverview } from "@/lib/admin/read";
import { requireAdmin } from "@/lib/admin/gate";

export const metadata: Metadata = { title: "Admin — SME24", robots: { index: false, follow: false } };

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

export default async function AdminPage() {
  await requireAdmin();
  const overview = await getOverview();
  const runs = Object.entries(overview.runsByStatus).sort();
  const users = Object.entries(overview.usersByRole).sort();
  return (
    <>
      <h1 className="text-2xl font-medium tracking-tight">Overview</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {runs.map(([status, count]) => <Tile key={status} label={`Runs · ${status}`} value={String(count)} />)}
        {users.map(([role, count]) => <Tile key={role} label={`Users · ${role}`} value={String(count)} />)}
        <Tile label="Expert applications pending" value={String(overview.pendingExperts)} />
      </div>
    </>
  );
}
