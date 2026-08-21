import type { Metadata } from "next";
import { LoginCard } from "@/components/portal/LoginCard";
import { safeNext } from "@/lib/auth/safe-next";
import { first } from "@/lib/search-params";

export const metadata: Metadata = { title: "Sign in — SME24" };

const errorCopy: Record<string, string> = {
  link_expired:
    "That sign-in link has expired or was already used. Request a new one below.",
  oauth_failed:
    "Google sign-in didn't complete. Try again, or use an email link instead.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const errorCode = first(params.error);
  return (
    <LoginCard
      next={safeNext(first(params.next))}
      error={errorCode ? errorCopy[errorCode] : undefined}
    />
  );
}
