import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listUsers } from "@/lib/admin/read";
import { requireAdmin } from "@/lib/admin/gate";

export const metadata: Metadata = { title: "Users — Admin — SME24", robots: { index: false, follow: false } };

const dateFormat = new Intl.DateTimeFormat("de-CH", { dateStyle: "medium", timeZone: "Europe/Zurich" });

export default async function AdminUsersPage() {
  await requireAdmin();
  const users = await listUsers();
  return (
    <>
      <h1 className="text-2xl font-medium tracking-tight">Users</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Expert status</TableHead>
            <TableHead>Joined</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell className="font-medium">{user.email}</TableCell>
              <TableCell><Badge variant="outline">{user.role}</Badge></TableCell>
              <TableCell className="text-muted-foreground">{user.expert_status}</TableCell>
              <TableCell className="text-muted-foreground">{dateFormat.format(new Date(user.created_at))}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}
