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
import {
  formatChf,
  formatChfRange,
  LOSS_CHF,
  type IncidentCost,
} from "@/lib/portal/incident-cost";
import { formatValue } from "@/lib/portal/ledger";

// The CHF figure of the report (CONTEXT.md, "Annual incident cost"): the
// loss model applied to stored counts, nothing estimated. Copy is fixed and
// says exactly which rows could not be priced.
export function IncidentCostCard({ cost }: { cost: IncidentCost | null }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>Annual incident cost</CardDescription>
        <CardTitle className="text-3xl tabular-nums">
          {cost ? formatChfRange(cost.min, cost.max) : "Cannot be estimated"}
        </CardTitle>
        <CardDescription>
          {cost
            ? "The cost of the incidents in the ledger, priced per incident from the ISO 45004 loss table. Not a comparison against peers."
            : "No incident count is disclosed or supplied, so there is nothing to price. Run a new search with your own counts to get a figure."}
        </CardDescription>
      </CardHeader>
      {cost && (
        <CardContent className="flex flex-col gap-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Count</TableHead>
                <TableHead className="text-right">Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cost.rows.map((row) => (
                <TableRow key={row.key}>
                  <TableCell className="font-medium">{row.label}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatValue(row.count)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatChfRange(row.min, row.max)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
            {cost.derivedUsed.length > 0 && (
              <li>
                Derived counts used:{" "}
                {cost.derivedUsed
                  .map(
                    (figure) =>
                      `${figure.label.toLowerCase()} ≈ ${formatValue(figure.value)} (${figure.formula})`,
                  )
                  .join("; ")}
                .
              </li>
            )}
            {cost.lostTimeUnknown && (
              <li>
                The lost-time count is not known, so every recordable injury is
                priced at the recordable row.
              </li>
            )}
            {cost.missing.length > 0 && (
              <li>
                Not priced (no count disclosed or supplied):{" "}
                {cost.missing.map((label) => label.toLowerCase()).join(", ")}.
              </li>
            )}
            <li>
              Per incident: fatality {formatChf(LOSS_CHF.fatality)}; lost-time
              injury {formatChf(LOSS_CHF.lostTimeMin)}–{formatChf(LOSS_CHF.lostTimeMax)};
              other recordable injury {formatChf(LOSS_CHF.recordable)}.
            </li>
          </ul>
        </CardContent>
      )}
    </Card>
  );
}
