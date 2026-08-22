import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { ExpertProfileForm } from "@/components/expert/ExpertProfileForm";
import { ExpertStatusCard } from "@/components/expert/ExpertStatusCard";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getUser } from "@/lib/auth/get-user";
import { getOwnExpert } from "@/lib/experts/read";

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

  const expert = await getOwnExpert();

  return (
    <>
      <ExpertStatusCard status="approved" />
      <Card>
        <CardHeader>
          <CardDescription>Client matches</CardDescription>
          <CardTitle className="text-xl">No matches yet</CardTitle>
          <CardDescription>
            When a client report names you among its top experts, it appears here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Users aria-hidden="true" className="size-5 text-muted-foreground" />
        </CardContent>
      </Card>
      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-medium tracking-tight">Your profile</h2>
        <ExpertProfileForm expert={expert} submitLabel="Save profile" />
      </section>
    </>
  );
}
