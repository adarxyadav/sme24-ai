import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ExpertMatch } from "@/lib/portal/matches";

// Stage 4 on the report: the top experts with the model's client-facing
// rationale. The score is not shown — the rank and the rationale carry it.
export function ExpertMatchesCard({ matches }: { matches: ExpertMatch[] }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>Matched experts</CardDescription>
        <CardTitle className="text-2xl">
          {matches.length > 0 ? "Who can help" : "No expert matched yet"}
        </CardTitle>
        <CardDescription>
          {matches.length > 0
            ? "Senior EHS consultants from our network, ranked by fit with this company’s risk profile."
            : "No approved expert in our network fits this profile yet. We add experts continuously; check back or contact us."}
        </CardDescription>
      </CardHeader>
      {matches.length > 0 && (
        <CardContent className="flex flex-col gap-4">
          {matches.map((match) => (
            <article
              key={match.rank}
              className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-4"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">#{match.rank}</p>
                  <h3 className="font-medium">{match.expert.full_name}</h3>
                  <p className="text-sm text-muted-foreground">{match.expert.headline}</p>
                </div>
                <Badge variant="outline" className="text-muted-foreground">
                  {match.expert.availability}
                </Badge>
              </div>
              <p className="text-sm">{match.rationale}</p>
              <div className="flex flex-wrap gap-1">
                {match.expert.competencies.map((name) => (
                  <Badge key={name} variant="secondary">
                    {name}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {match.expert.languages.join(", ")}
                {match.expert.regions.length > 0 && ` · ${match.expert.regions.join(", ")}`}
                {match.expert.years_experience !== null && ` · ${match.expert.years_experience} years`}
              </p>
            </article>
          ))}
        </CardContent>
      )}
    </Card>
  );
}
