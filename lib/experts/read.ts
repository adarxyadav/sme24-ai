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
