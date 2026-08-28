import { Download } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { formatChf } from "@/lib/portal/incident-cost";
import type { Proposal } from "@/lib/portal/proposal";

// Chapter 5 of the report: the proposal's headline content, the recommended
// package, the vault material it drew on, and the PDF behind a short signed
// URL — the report's single filled-teal action. The PDF is the deliverable;
// this card is its cover.
export function ProposalCard({ proposal }: { proposal: Proposal }) {
  const { content, tier, sources } = proposal;
  return (
    <div className="overflow-clip rounded-lg border border-border bg-card">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 px-5 pt-3.5">
        <h2 className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
          Consulting proposal
        </h2>
        {proposal.downloadUrl && (
          <a
            href={proposal.downloadUrl}
            className={buttonVariants({ size: "sm" })}
          >
            <Download aria-hidden="true" />
            Download PDF
          </a>
        )}
      </header>

      <div className="px-5 pt-1.5">
        <p className="text-xl font-medium tracking-tight">{content.title}</p>
        <p className="mt-1.5 max-w-176 text-xs text-muted-foreground">
          {content.executive_summary}
        </p>
      </div>

      <div className="grid gap-5 px-5 py-5">
        <div className="grid gap-1 rounded-md border border-border bg-muted/40 px-4 py-3.5">
          <span className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
            Recommended package
          </span>
          <p className="text-sm font-medium">
            {tier.number} — {tier.name}
            <span className="ml-2 text-xs font-normal whitespace-nowrap text-muted-foreground">
              {tier.priceChf === null
                ? "priced on request"
                : `${formatChf(tier.priceChf)} excl. MWST`}
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            {tier.format} · {tier.output}
          </p>
          <p className="mt-2 max-w-[56ch] text-sm">
            {content.recommendation_rationale}
          </p>
        </div>

        <div className="grid gap-2">
          <span className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
            Key risks
          </span>
          <ul className="grid gap-1.5 text-sm">
            {content.key_risks.map((risk) => (
              <li key={risk.risk}>
                <span className="font-medium">{risk.risk}</span>
                <span className="text-muted-foreground">
                  {" "}
                  — {risk.why_it_matters}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid gap-2">
          <span className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
            EHS Vault sources
          </span>
          {sources.length > 0 ? (
            <ul className="grid gap-1 text-sm">
              {sources.map((source) => (
                <li key={source.id}>
                  {source.title}
                  {source.source && (
                    <span className="text-muted-foreground">
                      {" "}
                      — {source.source}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Drafted without reference material — the vault held nothing
              relevant for this profile.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
