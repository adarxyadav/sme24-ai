import type { Metadata } from "next";
import { LoginCard } from "@/components/portal/LoginCard";
import { safeNext } from "@/lib/auth/safe-next";

export const metadata: Metadata = { title: "Sign in — SME24" };

const errorCopy: Record<string, string> = {
  link_expired:
    "That sign-in link has expired or was already used. Request a new one below.",
  oauth_failed:
    "Google sign-in didn't complete. Try again, or use an email link instead.",
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

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
