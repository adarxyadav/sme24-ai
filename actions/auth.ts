"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { safeNext } from "@/lib/auth/safe-next";
import { createClient } from "@/lib/supabase/server";

export type MagicLinkState = { error?: string; sent?: boolean } | undefined;

const emailSchema = z.email("Enter a valid email address.");

async function requestOrigin(): Promise<string> {
  const origin = (await headers()).get("origin");
  if (!origin) throw new Error("Missing Origin header on auth request");
  return origin;
}

function nextParam(formData: FormData): string {
  const next = formData.get("next");
  return safeNext(typeof next === "string" ? next : null);
}

export async function requestMagicLink(
  _prev: MagicLinkState,
  formData: FormData,
): Promise<MagicLinkState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const origin = await requestOrigin();
  const next = nextParam(formData);
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: {
      emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) {
    return {
      error:
        error.code === "over_email_send_rate_limit"
          ? "A link was sent recently. Wait a minute before requesting another."
          : "We couldn't send the link. Please try again.",
    };
  }
  return { sent: true };
}

export async function signInWithGoogle(formData: FormData): Promise<void> {
  const origin = await requestOrigin();
  const next = nextParam(formData);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error || !data.url) redirect("/login?error=oauth_failed");
  redirect(data.url);
}

export async function confirmMagicLink(formData: FormData): Promise<void> {
  const tokenHash = formData.get("token_hash");
  if (typeof tokenHash !== "string" || tokenHash.length === 0) {
    redirect("/login?error=link_expired");
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "email",
  });
  if (error) redirect("/login?error=link_expired");
  redirect(nextParam(formData));
}

export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/");
}
