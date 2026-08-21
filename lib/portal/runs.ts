import { createClient } from "@/lib/supabase/server";

// The read layer (pipeline-rules.md: the dashboard never talks to the engine).
// Every read is RLS-scoped through the cookie-bound client, so a run the caller
// does not own is simply absent — ownership is never re-checked in a page.

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

// Null for both "no such run" and "not yours" — RLS makes them the same answer,
// and a page must not be able to tell them apart.
export async function getRunById(id: string): Promise<Run | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("analysis_runs")
    .select("id, company_name, company_domain, status, created_at")
    .eq("id", id)
    .maybeSingle<Run>();

  if (error) {
    console.error("run lookup failed", id, error.message);
    return null;
  }
  return data;
}
