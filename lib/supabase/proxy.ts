import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/env";

const PROTECTED_PREFIXES = ["/dashboard", "/expert", "/admin"];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

// Refreshes the auth session cookies on every request so Server Components,
// which cannot write cookies, always see a valid session — then gates pages on
// the presence of a session only. Roles are never read here (auth.md).
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl(), supabasePublishableKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Local JWT verification; must run before the response is returned so a
  // refreshed token is written back.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);
  const { pathname, search } = request.nextUrl;

  // Only page navigations are gated; a Server Action POST must reach its page,
  // or the client sees a redirected action response and errors.
  if (request.method !== "GET" || pathname.startsWith("/auth/")) return response;

  let target: string | null = null;
  if (!signedIn && isProtected(pathname)) {
    target = `/login?next=${encodeURIComponent(pathname + search)}`;
  } else if (signedIn && pathname === "/login") {
    target = "/auth/redirect";
  }
  if (!target) return response;

  const redirect = NextResponse.redirect(new URL(target, request.url));
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}
