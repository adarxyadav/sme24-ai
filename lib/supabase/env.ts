function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

// Read per call, not at module scope: every importer of this file would
// otherwise have to satisfy every variable in it, so a missing secret key would
// break the RLS-scoped client and the proxy — taking down /login, the one page
// a misconfigured deployment needs to still work.
export function supabaseUrl(): string {
  return required("NEXT_PUBLIC_SUPABASE_URL");
}

export function supabasePublishableKey(): string {
  return required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
}

// Server-only; lib/supabase/service.ts is its sole reader and imports
// server-only, which is what keeps the secret out of a browser bundle.
export function supabaseSecretKey(): string {
  return required("SUPABASE_SECRET_KEY");
}
