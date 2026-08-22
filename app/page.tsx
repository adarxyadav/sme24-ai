import type { Metadata } from "next";
import Link from "next/link";
import { ExpertsCta } from "@/components/marketing/ExpertsCta";
import { Features } from "@/components/marketing/Features";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { PackagesSection } from "@/components/marketing/PackagesSection";
import { SearchForm } from "@/components/portal/SearchForm";
import { buttonVariants } from "@/components/ui/button";
import { getUser } from "@/lib/auth/get-user";

export const metadata: Metadata = {
  title: "SME24 — your safety KPIs, benchmarked, from just your company name",
  description:
    "Free EHS report for Swiss SMEs: safety KPIs with sources, annual incident cost in CHF, a peer benchmark, matched senior experts and a proposal PDF. Then fixed-price consulting packages.",
};

export default async function Home() {
  const current = await getUser();
  const ctaHref = current ? "#top" : "/login?next=/";
  const ctaLabel = current ? "Start your free report" : "Sign in to run a search";

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-24 px-4 py-16 sm:px-6 sm:py-24">
      <section id="top" className="flex flex-col items-start gap-10">
        <div className="flex flex-col gap-6">
          <h1 className="max-w-2xl text-4xl font-medium tracking-tight text-balance sm:text-5xl">
            Your safety KPIs, benchmarked — from just your company name.
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            SME24 researches your public disclosures, extracts EHS metrics with
            sources, prices last year’s incidents in CHF, shows where you stand
            against Swiss peers and matches you with senior experts. Free.
          </p>
        </div>
        {/* The trigger route requires a session, so signed-out visitors get the
            door rather than a form that can only 401. */}
        {current ? (
          <SearchForm />
        ) : (
          <Link href="/login?next=/" className={buttonVariants({ size: "lg" })}>
            Sign in to run a search
          </Link>
        )}
      </section>
      <HowItWorks />
      <Features />
      <PackagesSection ctaHref={ctaHref} ctaLabel={ctaLabel} />
      <ExpertsCta />
    </div>
  );
}
