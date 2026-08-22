import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Availability, CompetencyKey, LanguageKey, NaceSection, RegionKey } from "@/lib/experts/catalogue";

export type ExpertRow = {
  id: string;
  full_name: string;
  headline: string;
  bio: string | null;
  competencies: CompetencyKey[];
  sectors: NaceSection[];
  languages: LanguageKey[];
  regions: RegionKey[];
  years_experience: number | null;
  availability: Availability;
  updated_at: string;
};

// RLS-scoped: the owner policy is the only filter, so this is the caller's
// own row or null.
export async function getOwnExpert(): Promise<ExpertRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("experts")
    .select(
      "id, full_name, headline, bio, competencies, sectors, languages, regions, years_experience, availability, updated_at",
    )
    .maybeSingle<ExpertRow>();

  if (error) {
    console.error("expert lookup failed", error.message);
    return null;
  }
  return data;
}

export type OwnMatch = { run_id: string; company_name: string; rank: number; matched_at: string };

// The expert's side of stage 4, through a security definer function: company
// name and rank only — an expert holds no select on analysis_runs.
export async function getOwnMatches(): Promise<OwnMatch[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_expert_matches");
  if (error) {
    console.error("expert matches lookup failed", error.message);
    return [];
  }
  // No generated DB types in this repo; the function's declared return shape
  // is exactly OwnMatch (migration create_expert_matches).
  return (data ?? []) as OwnMatch[];
}
