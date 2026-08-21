import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/auth/safe-next";
import { createClient } from "@/lib/supabase/server";

// OAuth return (Google): exchange the PKCE code for a session, then land.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }
  return NextResponse.redirect(
    new URL("/login?error=oauth_failed", request.url),
  );
}
