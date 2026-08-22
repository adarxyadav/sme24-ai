import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  AVAILABILITY,
  COMPETENCIES,
  LANGUAGES,
  REGIONS,
  type Availability,
  type CompetencyKey,
  type LanguageKey,
  type RegionKey,
} from "@/lib/experts/catalogue";

// Stage 4's output for the dashboard: the matched experts with their public
// profile fields, catalogue keys already resolved to labels so the dashboard
// needs nothing beyond this module. Both the matches and the expert rows are
// RLS-scoped to the run's owner (t-018-spec.md D3).

export type ExpertMatch = {
  rank: number;
  score: number;
  rationale: string;
  expert: {
    full_name: string;
    headline: string;
    competencies: string[];
    languages: string[];
    regions: string[];
    years_experience: number | null;
    availability: string;
  };
};

type StoredExpert = {
  full_name: string;
  headline: string;
  competencies: CompetencyKey[];
  languages: LanguageKey[];
  regions: RegionKey[];
  years_experience: number | null;
  availability: Availability;
};

type StoredMatch = Omit<ExpertMatch, "expert"> & { expert: StoredExpert | null };

function label<K extends string>(record: Record<K, string>, key: K): string {
  return record[key] ?? key;
}

export async function getRunMatches(runId: string): Promise<ExpertMatch[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expert_matches")
    .select(
      "rank, score, rationale, expert:experts(full_name, headline, competencies, languages, regions, years_experience, availability)",
    )
    .eq("run_id", runId)
    .order("rank")
    .returns<StoredMatch[]>();

  if (error) {
    console.error("match lookup failed", runId, error.message);
    return [];
  }
  // A match whose expert row is unreadable is dropped rather than rendered
  // nameless.
  return data.flatMap((row) =>
    row.expert
      ? [
          {
            rank: row.rank,
            score: row.score,
            rationale: row.rationale,
            expert: {
              full_name: row.expert.full_name,
              headline: row.expert.headline,
              competencies: row.expert.competencies.map((k) => label(COMPETENCIES, k)),
              languages: row.expert.languages.map((k) => label(LANGUAGES, k)),
              regions: row.expert.regions.map((k) => label(REGIONS, k)),
              years_experience: row.expert.years_experience,
              availability: label(AVAILABILITY, row.expert.availability),
            },
          },
        ]
      : [],
  );
}
