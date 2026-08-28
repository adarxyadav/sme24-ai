import Link from "next/link";
import {
  formatChf,
  formatChfRange,
  LOSS_CHF,
  type CostRow,
  type IncidentCost,
} from "@/lib/portal/incident-cost";
import { formatValue } from "@/lib/portal/ledger";
import { cn } from "@/lib/utils";

const DOT_CLASSES: Record<CostRow["key"], string> = {
  fatalities: "before:bg-destructive",
  lost_time: "before:bg-warning",
  recordable: "before:bg-input",
};

// The math column: count × per-incident rate from the loss table. A derived
// count carries the ≈ it wears in the ledger.
function mathFor(row: CostRow, derived: boolean): string {
  const count = `${derived ? "≈ " : ""}${formatValue(row.count)}`;
  if (row.key === "fatalities") return `${count} × ${formatValue(LOSS_CHF.fatality)}`;
  if (row.key === "lost_time")
    return `${count} × ${formatValue(LOSS_CHF.lostTimeMin)}–${formatValue(LOSS_CHF.lostTimeMax)}`;
  return `${count} × ${formatValue(LOSS_CHF.recordable)}`;
}

// The cost rail: the maximum total as one line — severity segments in the
// loss model's order, the lost-time min–max spread hatched at the end.
function CostRail({ cost }: { cost: IncidentCost }) {
  if (cost.max <= 0) return null;
  const width = (value: number) => `${(value / cost.max) * 100}%`;
  const byKey = new Map(cost.rows.map((row) => [row.key, row]));
  const fat = byKey.get("fatalities");
  const lti = byKey.get("lost_time");
  const rec = byKey.get("recordable");
  const spread = lti ? lti.max - lti.min : 0;

  return (
    <div
      className="px-5 pt-4"
      role="img"
      aria-label={`Of the maximum ${formatChf(cost.max)}: ${cost.rows
        .map((row) => `${row.label.toLowerCase()} ${formatChfRange(row.min, row.max)}`)
        .join(", ")}`}
    >
      <div className="flex h-2 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
        {fat && fat.max > 0 && (
          <i className="bg-destructive" style={{ width: width(fat.max) }} />
        )}
        {lti && lti.min > 0 && (
          <i className="bg-warning" style={{ width: width(lti.min) }} />
        )}
        {rec && rec.max > 0 && (
          <i className="bg-input" style={{ width: width(rec.max) }} />
        )}
        {spread > 0 && (
          <i
            className="bg-[repeating-linear-gradient(-45deg,var(--warning)_0_3px,transparent_3px_6px)]"
            style={{ width: width(spread) }}
          />
        )}
      </div>
      {spread > 0 && (
        <p className="mt-1.5 text-right text-[11px] text-muted-foreground">
          hatched — the lost-time min–max spread
        </p>
      )}
    </div>
  );
}

// Chapter 3 of the report — the invoice pass: the CHF figure of the report
// (CONTEXT.md, "Annual incident cost"), the loss model applied to stored
// counts as line items, nothing estimated. Copy is fixed and says exactly
// which rows could not be priced.
export function IncidentCostCard({ cost }: { cost: IncidentCost | null }) {
  const derivedLabels = new Set(
    cost?.derivedUsed.map((figure) => figure.label) ?? [],
  );

  return (
    <div className="overflow-clip rounded-lg border border-border bg-card">
      <header className="px-5 pt-3.5">
        <h2 className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
          Annual incident cost
        </h2>
      </header>

      <div className={cn("px-5 pt-1.5", !cost && "pb-0")}>
        <p
          className={cn(
            "font-mono text-2xl font-medium tracking-tight tabular-nums",
            !cost && "font-sans text-lg text-muted-foreground",
          )}
        >
          {cost ? formatChfRange(cost.min, cost.max) : "Cannot be estimated"}
        </p>
        <p className="mt-1.5 max-w-176 text-xs text-muted-foreground">
          {cost
            ? "The cost of the incidents in the ledger, priced per incident from the ISO 45004 loss table. Not a comparison against peers."
            : "No incident count is disclosed or supplied, so there is nothing to price."}
        </p>
      </div>

      {cost ? (
        <>
          <CostRail cost={cost} />

          <ul className="mt-4">
            {cost.rows.map((row) => {
              const derived = derivedLabels.has(
                row.key === "recordable" ? "Recordable injuries" : row.label,
              );
              const zero = row.count === 0;
              return (
                <li
                  key={row.key}
                  className={cn(
                    "grid grid-cols-[1fr_auto] items-baseline gap-x-5 gap-y-1 border-t border-border px-5 py-2.5 sm:grid-cols-[1fr_auto_auto]",
                    zero && "text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex items-baseline gap-2 font-medium before:size-1.5 before:flex-none before:self-center before:rounded-full before:content-['']",
                      DOT_CLASSES[row.key],
                      zero &&
                        "font-normal before:bg-transparent before:shadow-[inset_0_0_0_1px_var(--input)]",
                    )}
                  >
                    {row.label}
                  </span>
                  <span className="pl-3.5 text-left font-mono text-xs text-muted-foreground tabular-nums sm:pl-0 sm:text-right">
                    {mathFor(row, derived)}
                  </span>
                  <span className="col-start-2 row-span-2 row-start-1 self-center text-right font-mono text-[13px] tabular-nums sm:col-start-auto sm:row-span-1 sm:row-start-auto sm:min-w-36 sm:self-baseline">
                    {row.min === row.max
                      ? formatValue(row.min)
                      : `${formatValue(row.min)} – ${formatValue(row.max)}`}
                  </span>
                </li>
              );
            })}
          </ul>

          <footer className="grid gap-1 border-t border-border px-5 py-3 text-xs text-muted-foreground">
            {cost.derivedUsed.map((figure) => (
              <span key={figure.label}>
                Derived counts used: {figure.label.toLowerCase()} ≈{" "}
                {formatValue(figure.value)} — {figure.formula}.
              </span>
            ))}
            {cost.lostTimeUnknown && (
              <span>
                The lost-time count is not known, so every recordable injury is
                priced at the recordable row.
              </span>
            )}
            {cost.missing.length > 0 && (
              <span>
                Not priced (no count disclosed or supplied):{" "}
                {cost.missing.map((label) => label.toLowerCase()).join(", ")}.
              </span>
            )}
            <span>
              Per incident: fatality {formatChf(LOSS_CHF.fatality)}; lost-time
              injury {formatChf(LOSS_CHF.lostTimeMin)}–
              {formatChf(LOSS_CHF.lostTimeMax)}; other recordable injury{" "}
              {formatChf(LOSS_CHF.recordable)}.
            </span>
          </footer>
        </>
      ) : (
        <footer className="mt-4 border-t border-border px-5 py-3 text-xs">
          <Link
            href="/dashboard"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Run a new search with your own counts
          </Link>
        </footer>
      )}
    </div>
  );
}
