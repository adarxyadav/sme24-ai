import { Users } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { OwnMatch } from "@/lib/experts/read";

const dateFormat = new Intl.DateTimeFormat("de-CH", { dateStyle: "medium" });

// The runs that named this expert: company and rank, nothing else of the run.
export function ExpertMatchesList({ matches }: { matches: OwnMatch[] }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>Client matches</CardDescription>
        <CardTitle className="text-xl">
          {matches.length > 0 ? `${matches.length} report${matches.length === 1 ? "" : "s"} name you` : "No matches yet"}
        </CardTitle>
        <CardDescription>
          When a client report names you among its top experts, it appears here.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {matches.length === 0 ? (
          <Users aria-hidden="true" className="size-5 text-muted-foreground" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead className="text-right">Rank</TableHead>
                <TableHead>Matched</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {matches.map((match) => (
                <TableRow key={match.run_id}>
                  <TableCell className="font-medium">{match.company_name}</TableCell>
                  <TableCell className="text-right tabular-nums">#{match.rank}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {dateFormat.format(new Date(match.matched_at))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
