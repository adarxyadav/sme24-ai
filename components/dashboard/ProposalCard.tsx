import { BookOpen, Download } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatChf } from "@/lib/portal/incident-cost";
import type { Proposal } from "@/lib/portal/proposal";

// Stage 5 on the report: the proposal's headline content, the recommended
// package, the vault material it drew on, and the PDF behind a short signed
// URL. The PDF is the deliverable; this card is its cover.
export function ProposalCard({ proposal }: { proposal: Proposal }) {
  const { content, tier, sources } = proposal;
  return (
    <Card>
      <CardHeader>
        <CardDescription>Consulting proposal</CardDescription>
        <CardTitle className="text-2xl">{content.title}</CardTitle>
        <CardDescription>{content.executive_summary}</CardDescription>
        {proposal.downloadUrl && (
          <CardAction>
            <a href={proposal.downloadUrl} className={buttonVariants({ size: "sm" })}>
              <Download aria-hidden="true" />
              Download PDF
            </a>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col gap-1 rounded-lg border border-border bg-muted/40 p-4">
          <p className="text-xs text-muted-foreground">Recommended package</p>
          <p className="font-medium">
            {tier.number} — {tier.name}
            <span className="ml-2 text-sm text-muted-foreground">
              {tier.priceChf === null ? "priced on request" : `${formatChf(tier.priceChf)} excl. MWST`}
            </span>
          </p>
          <p className="text-sm text-muted-foreground">{tier.format} · {tier.output}</p>
          <p className="mt-2 text-sm">{content.recommendation_rationale}</p>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">Key risks</p>
          <ul className="flex flex-col gap-2 text-sm">
            {content.key_risks.map((risk) => (
              <li key={risk.risk}>
                <span className="font-medium">{risk.risk}</span>
                <span className="text-muted-foreground"> — {risk.why_it_matters}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <BookOpen aria-hidden="true" className="size-3.5" />
            EHS Vault sources
          </p>
          {sources.length > 0 ? (
            <ul className="flex flex-col gap-1 text-sm">
              {sources.map((source) => (
                <li key={source.id}>
                  {source.title}
                  {source.source && <span className="text-muted-foreground"> — {source.source}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Drafted without reference material — the vault held nothing relevant for this profile.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
