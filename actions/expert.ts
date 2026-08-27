"use server";

import { revalidatePath } from "next/cache";
import { expertProfileSchema } from "@/lib/experts/schema";
import { createClient } from "@/lib/supabase/server";

export type ExpertFormState =
  | { errors?: Record<string, string>; error?: string; saved?: boolean }
  | undefined;

function strings(formData: FormData, key: string): string[] {
  return formData.getAll(key).filter((v): v is string => typeof v === "string");
}

// Apply or edit: one function, because the DB side is one upsert
// (apply_as_expert). The session client calls it, so RLS and auth.uid() are
// the authority — no service role in a client-role action (auth.md).
export async function saveExpertProfile(
  _prev: ExpertFormState,
  formData: FormData,
): Promise<ExpertFormState> {
  const years = formData.get("years_experience");
  const parsed = expertProfileSchema.safeParse({
    full_name: formData.get("full_name"),
    headline: formData.get("headline"),
    bio: formData.get("bio") ?? undefined,
    competencies: strings(formData, "competencies"),
    sectors: strings(formData, "sectors"),
    languages: strings(formData, "languages"),
    regions: strings(formData, "regions"),
    years_experience:
      typeof years === "string" && years.trim() !== "" ? Number(years) : undefined,
    availability: formData.get("availability") ?? "available",
  });

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      errors[key] ??= issue.message;
    }
    return { errors };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("apply_as_expert", { p_profile: parsed.data });
  if (error) {
    console.error("apply_as_expert failed", error.message);
    return { error: "We couldn't save your profile. Please try again." };
  }

  revalidatePath("/expert", "layout");
  return { saved: true };
}
