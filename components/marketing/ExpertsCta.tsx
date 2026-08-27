import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

// The other side of the marketplace: a strip for consultants.
export function ExpertsCta() {
  return (
    <section id="for-experts" aria-labelledby="for-experts-title" className="flex flex-col gap-4 rounded-xl border border-border bg-muted/40 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">For experts</p>
        <h2 id="for-experts-title" className="text-2xl font-medium tracking-tight">Senior EHS consultant? Join the network.</h2>
        <p className="max-w-xl text-muted-foreground">
          Clients are matched to you on competency fit, not on who shouts loudest. Tell us what you do; we review every profile by hand.
        </p>
      </div>
      <Link href="/expert/apply" className={buttonVariants({ variant: "outline", size: "lg" })}>Apply as an expert</Link>
    </section>
  );
}
