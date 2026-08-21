import { createClient } from "@/lib/supabase/server";

export type UserRole = "client" | "expert" | "admin";
export type ExpertStatus = "none" | "pending" | "approved" | "rejected";

export type AuthUser = { id: string; email: string | null };
export type Profile = { id: string; role: UserRole; expert_status: ExpertStatus };

export type CurrentUser = { user: AuthUser; profile: Profile } | null;

// Identity from the verified JWT, role from profiles. A missing profile is a
// bug (the DB trigger creates it), so it is logged and treated as signed out —
// never replaced by a fabricated client profile.
export async function getUser(): Promise<CurrentUser> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, role, expert_status")
    .eq("id", claims.sub)
    .maybeSingle<Profile>();

  if (error || !profile) {
    console.error("profiles row missing for user", claims.sub, error?.message);
    return null;
  }

  return {
    user: {
      id: claims.sub,
      email: typeof claims.email === "string" ? claims.email : null,
    },
    profile,
  };
}
