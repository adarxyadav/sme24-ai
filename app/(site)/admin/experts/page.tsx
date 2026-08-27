import type { Metadata } from "next";
import { ExpertDecisionForm } from "@/components/admin/ExpertDecisionForm";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listExperts, listUsers } from "@/lib/admin/read";
import { requireAdmin } from "@/lib/admin/gate";

export const metadata: Metadata = { title: "Experts — Admin — SME24", robots: { index: false, follow: false } };

// Applications and approved experts in one table: the profile's
// expert_status is the state, the form is the only way to change it.
export default async function AdminExpertsPage() {
  await requireAdmin();
  const [experts, users] = await Promise.all([listExperts(), listUsers()]);
  const byUser = new Map(users.map((u) => [u.id, u]));
  return (
    <>
      <h1 className="text-2xl font-medium tracking-tight">Experts</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Expert</TableHead>
            <TableHead>Competencies</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Decision</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {experts.map((expert) => {
            const user = byUser.get(expert.user_id);
            const status = user?.expert_status ?? "none";
            return (
              <TableRow key={expert.id}>
                <TableCell>
                  <div className="font-medium">{expert.full_name}</div>
                  <div className="text-xs text-muted-foreground">{user?.email ?? expert.user_id.slice(0, 8)} · {expert.headline}</div>
                </TableCell>
                <TableCell className="whitespace-normal text-xs text-muted-foreground">{expert.competencies.join(", ")}</TableCell>
                <TableCell><Badge variant="outline">{status}</Badge></TableCell>
                <TableCell><ExpertDecisionForm userId={expert.user_id} status={status} /></TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </>
  );
}
