import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";

// Role dispatcher: every sign-in lands here.
export async function GET(request: NextRequest) {
  const current = await getUser();
  if (!current) {
    // No usable identity (no session, or a session without a profile): drop
    // the cookies so the proxy and this handler cannot bounce each other.
    const supabase = await createClient();
    await supabase.auth.signOut({ scope: "local" });
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { role, expert_status } = current.profile;
  const target =
    role === "admin"
      ? "/admin"
      : role === "expert"
        ? "/expert"
        : expert_status === "pending"
          ? "/expert/apply"
          : "/dashboard";
  return NextResponse.redirect(new URL(target, request.url));
}
