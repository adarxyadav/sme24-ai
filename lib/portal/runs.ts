import "server-only";
import { createClient } from "@/lib/supabase/server";

// The read layer (pipeline-rules.md: the dashboard never talks to the engine).
// Every read goes through the cookie-bound client, and since T-022's admin
// select policies made RLS wider than ownership, the run readers here pin
// user_id to the caller's uid themselves (T-036): the dashboard shows own runs
// only, for admins too — everyone's runs live under /admin. Pages still hold
// no user id and no ownership check.
// Column lists are explicit: `error`, `cache_key`, `processor` and
// `uploaded_report_path` are pipeline-internal and never selected here;
// `research` stays internal too, except the single headcount scalar the
// derivation rules need (getRunHeadcount).

export type RunStatus =
  | "queued"
  | "researching"
  | "extracting"
  | "benchmarking"
  | "matching"
  | "generating"
  | "completed"
  | "failed"
  | "no_data";

export type Run = {
  id: string;
  company_name: string;
  company_domain: string | null;
  status: RunStatus;
  created_at: string;
};

const RUN_COLUMNS = "id, company_name, company_domain, status, created_at";

async function ownClient() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return { supabase, uid: data?.claims?.sub ?? null };
}

// Null for both "no such run" and "not yours" — the ownership predicate makes
// them the same answer, and a page must not be able to tell them apart.
export async function getRunById(id: string): Promise<Run | null> {
  const { supabase, uid } = await ownClient();
  if (!uid) return null;
  const { data, error } = await supabase
    .from("analysis_runs")
    .select(RUN_COLUMNS)
    .eq("id", id)
    .eq("user_id", uid)
    .maybeSingle<Run>();

  if (error) {
    console.error("run lookup failed", id, error.message);
    return null;
  }
  return data;
}

// The one research field the report reads: headcount feeds the hours
// derivation (kpi-contract.md, Derivation rules). Selected as a scalar via a
// JSON path so the rest of the envelope never crosses the boundary.
export async function getRunHeadcount(id: string): Promise<number | null> {
  const { supabase, uid } = await ownClient();
  if (!uid) return null;
  const { data, error } = await supabase
    .from("analysis_runs")
    .select("headcount:research->output->company->headcount")
    .eq("id", id)
    .eq("user_id", uid)
    .maybeSingle<{ headcount: unknown }>();

  if (error) {
    console.error("headcount lookup failed", id, error.message);
    return null;
  }
  const value = data?.headcount;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function listRuns(): Promise<Run[]> {
  const { supabase, uid } = await ownClient();
  if (!uid) return [];
  const { data, error } = await supabase
    .from("analysis_runs")
    .select(RUN_COLUMNS)
    .eq("user_id", uid)
    .order("created_at", { ascending: false })
    .returns<Run[]>();

  if (error) {
    console.error("run list failed", error.message);
    return [];
  }
  return data;
}
