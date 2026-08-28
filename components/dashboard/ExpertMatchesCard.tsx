import { Badge } from "@/components/ui/badge";
import type { ExpertMatch } from "@/lib/portal/matches";
import { cn } from "@/lib/utils";

// Availability as a toned dot; "unavailable" gets an outline dot so absence
// never wears a status color.
const AVAILABILITY_TONES: Record<
  ExpertMatch["expert"]["availability"]["key"],
  string
> = {
  available: "text-success before:bg-current",
  limited: "text-warning before:bg-current",
  unavailable:
    "text-muted-foreground before:bg-transparent before:shadow-[inset_0_0_0_1.5px_currentColor]",
};

// Chapter 4 of the report: the top experts with the model's client-facing
// rationale, ranked by fit — score shown with a teal fit bar (report brief;
// supersedes the earlier score-hidden ruling).
export function ExpertMatchesCard({ matches }: { matches: ExpertMatch[] }) {
  return (
    <div className="overflow-clip rounded-lg border border-border bg-card">
      <header className="px-5 pt-3.5">
        <h2 className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
          Matched experts
        </h2>
      </header>

      <div className={cn("px-5 pt-1.5", matches.length === 0 && "pb-4")}>
        <p
          className={cn(
            "text-xl font-medium tracking-tight",
            matches.length === 0 && "text-lg text-muted-foreground",
          )}
        >
          {matches.length > 0 ? "Who can help" : "No expert matched yet"}
        </p>
        <p className="mt-1.5 max-w-176 text-xs text-muted-foreground">
          {matches.length > 0
            ? "Senior EHS consultants from our network, ranked by fit with this company’s risk profile."
            : "No approved expert in our network fits this profile yet. We add experts continuously; check back or contact us."}
        </p>
      </div>

      {matches.length > 0 && (
        <ol className="mt-4">
          {matches.map((match) => (
            <li
              key={match.rank}
              className="grid gap-x-5 gap-y-1.5 border-t border-border px-5 py-4 sm:grid-cols-[5.5rem_1fr_auto]"
            >
              <div className="flex items-baseline gap-2.5 sm:grid sm:content-start sm:gap-1">
                <span className="text-[11px] whitespace-nowrap text-muted-foreground">
                  #{match.rank} · fit
                </span>
                <span className="font-mono text-[15px] font-medium tabular-nums">
                  {match.score}
                  <span className="font-sans text-[11px] font-normal text-muted-foreground">
                    {" "}
                    / 100
                  </span>
                </span>
                <span
                  className="h-0.75 w-16 self-center overflow-hidden rounded-full bg-border sm:self-auto"
                  aria-hidden="true"
                >
                  <b
                    className="block h-full rounded-full bg-primary"
                    style={{ width: `${Math.max(0, Math.min(match.score, 100))}%` }}
                  />
                </span>
              </div>

              <div className="min-w-0 sm:col-start-2 sm:row-start-1">
                <h3 className="text-sm font-semibold tracking-tight">
                  {match.expert.full_name}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {match.expert.headline}
                </p>
                <p className="mt-1.5 max-w-[52ch] text-sm">{match.rationale}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {match.expert.competencies.map((name) => (
                    <Badge key={name} variant="secondary">
                      {name}
                    </Badge>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  {match.expert.languages.join(", ")}
                  {match.expert.regions.length > 0 &&
                    ` · ${match.expert.regions.join(", ")}`}
                  {match.expert.years_experience !== null &&
                    ` · ${match.expert.years_experience} years`}
                </p>
              </div>

              <span
                className={cn(
                  "row-start-2 inline-flex items-center gap-1.5 self-start text-xs whitespace-nowrap before:size-1.5 before:rounded-full before:content-[''] sm:col-start-3 sm:row-start-1 sm:mt-0.5 sm:justify-self-end",
                  AVAILABILITY_TONES[match.expert.availability.key],
                )}
              >
                {match.expert.availability.label}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
