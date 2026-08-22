import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ExpertMatchesList } from "@/components/expert/ExpertMatchesList";
import { ExpertProfileForm } from "@/components/expert/ExpertProfileForm";
import { ExpertStatusCard } from "@/components/expert/ExpertStatusCard";
import { getUser } from "@/lib/auth/get-user";
import { getOwnExpert, getOwnMatches } from "@/lib/experts/read";

export const metadata: Metadata = {
  title: "Expert area — SME24",
  robots: { index: false, follow: false },
};

// The expert surface: role `expert` only (set by an admin on approval —
// auth.md). Anyone else is sent to the application page.
export default async function ExpertPage() {
  const current = await getUser();
  if (!current) redirect("/login?next=/expert");
  if (current.profile.role !== "expert") redirect("/expert/apply");

  const [expert, matches] = await Promise.all([getOwnExpert(), getOwnMatches()]);

  return (
    <>
      <ExpertStatusCard status="approved" />
      <ExpertMatchesList matches={matches} />
      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-medium tracking-tight">Your profile</h2>
        <ExpertProfileForm expert={expert} submitLabel="Save profile" />
      </section>
    </>
  );
}
