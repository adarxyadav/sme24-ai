import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TIERS } from "@/lib/packages/tiers";
import { formatChf } from "@/lib/portal/incident-cost";

// The four tiers from lib/packages/tiers.ts (packages.md is the source of
// truth). No checkout here yet; every tier's next step is the free report,
// and tier 4 is priced on request.
export function PackagesSection({ ctaHref, ctaLabel }: { ctaHref: string; ctaLabel: string }) {
  return (
    <section id="packages" aria-labelledby="packages-title" className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Packages</p>
        <h2 id="packages-title" className="text-2xl font-medium tracking-tight">When the report says act, pick the depth</h2>
        <p className="max-w-2xl text-muted-foreground">
          Three fixed-price assessments and one delivery engagement. Prices exclude Swiss MWST; the report is free either way.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {TIERS.map((tier) => (
          <Card key={tier.id} className="flex flex-col">
            <CardHeader>
              <CardDescription>{tier.number} · {tier.bestFor}</CardDescription>
              <CardTitle className="text-lg">{tier.name}</CardTitle>
              <p className="text-2xl font-medium tabular-nums">
                {tier.priceChf === null ? "On request" : formatChf(tier.priceChf)}
              </p>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-3 text-sm">
              <dl className="flex flex-col gap-2">
                <div><dt className="text-xs text-muted-foreground">Format</dt><dd>{tier.format}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Scope</dt><dd>{tier.scope}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Output</dt><dd>{tier.output}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Outcome</dt><dd>{tier.outcome}</dd></div>
              </dl>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="flex flex-col items-start gap-3">
        <Link href={ctaHref} className={buttonVariants({ size: "lg" })}>{ctaLabel}</Link>
        <p className="text-xs text-muted-foreground">
          Tier 3’s exact scope wording is being confirmed with our consulting partners; the rest is final.
        </p>
      </div>
    </section>
  );
}
