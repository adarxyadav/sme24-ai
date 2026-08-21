import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/env";

// RLS-scoped client for Server Components, Server Actions and route handlers.
// Service-role access is deliberately absent here — it lives in
// lib/supabase/service.ts, whose callers are trigger/, app/api/webhooks/, and
// app/api/ route handlers that authenticate the session themselves
// (library-docs.md, Supabase).
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl(), supabasePublishableKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Components cannot set cookies; proxy.ts refreshes the session
          // for them, so dropping the write here is safe.
        }
      },
    },
  });
}
