import Link from "next/link";
import { SearchForm } from "@/components/portal/SearchForm";
import { buttonVariants } from "@/components/ui/button";
import { getUser } from "@/lib/auth/get-user";

export default async function Home() {
  const current = await getUser();

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-start justify-center gap-10 px-4 py-24 sm:px-6">
      <div className="flex flex-col gap-6">
        <h1 className="max-w-2xl text-4xl font-medium tracking-tight text-balance sm:text-5xl">
          Your safety KPIs, benchmarked — from just your company name.
        </h1>
        <p className="max-w-xl text-lg text-muted-foreground">
          SME24 researches your public disclosures, extracts EHS metrics with
          sources, and shows where you stand against Swiss peers. Free.
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
  );
}
