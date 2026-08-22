import type { Metadata } from "next";
import { AdminRunTable } from "@/components/admin/AdminRunTable";
import { listAllRuns, listUsers } from "@/lib/admin/read";
import { requireAdmin } from "@/lib/admin/gate";

export const metadata: Metadata = { title: "Runs — Admin — SME24", robots: { index: false, follow: false } };

export default async function AdminRunsPage() {
  await requireAdmin();
  const [runs, users] = await Promise.all([listAllRuns(), listUsers()]);
  const emails = new Map(users.map((u) => [u.id, u.email]));
  return (
    <>
      <h1 className="text-2xl font-medium tracking-tight">Runs</h1>
      <AdminRunTable runs={runs} emails={emails} />
    </>
  );
}
