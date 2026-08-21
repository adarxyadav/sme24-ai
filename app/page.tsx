import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-start justify-center gap-6 px-4 py-24 sm:px-6">
      <h1 className="max-w-2xl text-4xl font-medium tracking-tight text-balance sm:text-5xl">
        Your safety KPIs, benchmarked — from just your company name.
      </h1>
      <p className="max-w-xl text-lg text-muted-foreground">
        SME24 researches your public disclosures, extracts EHS metrics with
        sources, and shows where you stand against Swiss peers. Free.
      </p>
      <Button size="lg" disabled>
        Search coming soon
      </Button>
    </section>
  );
}
