import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ExpertProfileForm } from "@/components/expert/ExpertProfileForm";
import { ExpertStatusCard } from "@/components/expert/ExpertStatusCard";
import { getUser } from "@/lib/auth/get-user";
import { getOwnExpert } from "@/lib/experts/read";

export const metadata: Metadata = {
  title: "Apply as an expert — SME24",
  robots: { index: false, follow: false },
};

// The proxy already requires a session here; the page decides by role and
// application status (auth.md, Landing).
export default async function ExpertApplyPage() {
  const current = await getUser();
  if (!current) redirect("/login?next=/expert/apply");
  if (current.profile.role === "expert") redirect("/expert");

  const status = current.profile.expert_status;

  if (status !== "none") {
    return <ExpertStatusCard status={status} />;
  }

  const expert = await getOwnExpert();

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-medium tracking-tight">Apply as an EHS expert</h1>
        <p className="text-muted-foreground">
          Senior EHS consultants deliver SME24’s packages. Tell us what you do;
          we review every profile by hand before it is matched to clients.
        </p>
      </div>
      <ExpertProfileForm expert={expert} submitLabel="Submit application" />
    </>
  );
}
