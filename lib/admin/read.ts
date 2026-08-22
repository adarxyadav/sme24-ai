import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ExpertStatus, UserRole } from "@/lib/auth/get-user";
import type { RunStatus } from "@/lib/portal/runs";

// The admin read layer: every read is RLS-scoped through the session client
// and reaches rows only because the admin policies exist (t-022-spec.md D1).
// A client session gets zero rows from all of these, never an error path
// that differs.

export type AdminUser = {
  id: string;
  email: string;
  role: UserRole;
  expert_status: ExpertStatus;
  created_at: string;
};

export async function listUsers(): Promise<AdminUser[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_users");
  if (error) {
    console.error("admin_list_users failed", error.message);
    return [];
  }
  // No generated DB types; the function declares exactly this row shape.
  return (data ?? []) as AdminUser[];
}

export type AdminRun = {
  id: string;
  user_id: string;
  company_name: string;
  company_domain: string | null;
  status: RunStatus;
  processor: "base" | "ultra";
  created_at: string;
  completed_at: string | null;
};

export async function listAllRuns(): Promise<AdminRun[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("analysis_runs")
    .select("id, user_id, company_name, company_domain, status, processor, created_at, completed_at")
    .order("created_at", { ascending: false })
    .limit(200)
    .returns<AdminRun[]>();
  if (error) {
    console.error("admin run list failed", error.message);
    return [];
  }
  return data;
}

export type AdminRunDetail = AdminRun & {
  error: string | null;
  trigger_run_id: string | null;
  uploaded_report_path: string | null;
  cache_key: string;
};

export type AgentLogRow = {
  id: number;
  stage: string;
  level: "info" | "warn" | "error";
  message: string;
  payload: Record<string, unknown> | null;
  created_at: string;
};

export async function getRunDetail(
  id: string,
): Promise<{ run: AdminRunDetail; logs: AgentLogRow[]; kpiCount: number } | null> {
  const supabase = await createClient();
  const { data: run, error } = await supabase
    .from("analysis_runs")
    .select(
      "id, user_id, company_name, company_domain, status, processor, created_at, completed_at, error, trigger_run_id, uploaded_report_path, cache_key",
    )
    .eq("id", id)
    .maybeSingle<AdminRunDetail>();
  if (error || !run) return null;

  const [{ data: logs }, { count }] = await Promise.all([
    supabase
      .from("agent_logs")
      .select("id, stage, level, message, payload, created_at")
      .eq("run_id", id)
      .order("id")
      .returns<AgentLogRow[]>(),
    supabase.from("kpis").select("id", { count: "exact", head: true }).eq("run_id", id),
  ]);

  return { run, logs: logs ?? [], kpiCount: count ?? 0 };
}

export type AdminExpert = {
  id: string;
  user_id: string;
  full_name: string;
  headline: string;
  competencies: string[];
  languages: string[];
  years_experience: number | null;
  availability: string;
  created_at: string;
};

export async function listExperts(): Promise<AdminExpert[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("experts")
    .select("id, user_id, full_name, headline, competencies, languages, years_experience, availability, created_at")
    .order("created_at", { ascending: false })
    .returns<AdminExpert[]>();
  if (error) {
    console.error("admin expert list failed", error.message);
    return [];
  }
  return data;
}

export type Overview = {
  runsByStatus: Record<string, number>;
  usersByRole: Record<string, number>;
  pendingExperts: number;
};

export async function getOverview(): Promise<Overview> {
  const [runs, users] = await Promise.all([listAllRuns(), listUsers()]);
  const runsByStatus: Record<string, number> = {};
  for (const run of runs) runsByStatus[run.status] = (runsByStatus[run.status] ?? 0) + 1;
  const usersByRole: Record<string, number> = {};
  for (const user of users) usersByRole[user.role] = (usersByRole[user.role] ?? 0) + 1;
  return {
    runsByStatus,
    usersByRole,
    pendingExperts: users.filter((u) => u.expert_status === "pending").length,
  };
}
