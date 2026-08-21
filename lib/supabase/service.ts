import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { supabaseSecretKey, supabaseUrl } from "@/lib/supabase/env";

// Service-role client: bypasses RLS entirely, so the caller owns every check
// RLS would otherwise make. Permitted callers are trigger/ tasks,
// app/api/webhooks/, and app/api/ route handlers that authenticate the session
// and derive user_id from it themselves (library-docs.md, Supabase).
//
// No session, no cookies: persistSession/autoRefreshToken off keeps this client
// from ever picking up a user's token and confusing the two authorities.
export function createServiceClient() {
  return createSupabaseClient(supabaseUrl(), supabaseSecretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
