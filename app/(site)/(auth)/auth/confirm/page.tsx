import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MagicLinkConfirm } from "@/components/portal/MagicLinkConfirm";
import { safeNext } from "@/lib/auth/safe-next";
import { first } from "@/lib/search-params";

export const metadata: Metadata = {
  title: "Confirm sign-in — SME24",
  robots: { index: false, follow: false },
};

export default async function ConfirmPage({
  searchParams,
}: PageProps<"/auth/confirm">) {
  const params = await searchParams;
  const tokenHash = first(params.token_hash);
  if (!tokenHash) redirect("/login?error=link_expired");
  return (
    <MagicLinkConfirm tokenHash={tokenHash} next={safeNext(first(params.next))} />
  );
}
