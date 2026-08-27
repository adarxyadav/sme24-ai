import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { getUser } from "@/lib/auth/get-user";
import { listRuns } from "@/lib/portal/runs";

// The proxy gates this path on a session; getUser here only feeds the shell
// (email, role) and catches the missing-profile edge as signed out.
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const current = await getUser();
  if (!current) redirect(`/login?next=${encodeURIComponent("/dashboard")}`);

  const runs = await listRuns();

  return (
    <DashboardShell
      email={current.user.email}
      role={current.profile.role}
      runs={runs.map((run) => ({ id: run.id, companyName: run.company_name }))}
    >
      {children}
    </DashboardShell>
  );
}
