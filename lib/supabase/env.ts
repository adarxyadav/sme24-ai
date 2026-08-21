function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

export const supabaseUrl = required("NEXT_PUBLIC_SUPABASE_URL");
export const supabasePublishableKey = required(
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
);

// Server-only. Reading this at module scope means an import from a Client
// Component fails the build rather than shipping the secret to the browser.
export const supabaseSecretKey = required("SUPABASE_SECRET_KEY");
