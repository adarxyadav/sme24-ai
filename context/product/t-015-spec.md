# T-015 spec — Annual incident cost (CHF) in the read layer

Decided 2026-08-22 before any code. This file records what was decided; it
does not reopen it. The acceptance criteria are the ticket's Check, quoted
verbatim below — nothing here restates or reinterprets it.

## Acceptance criteria

From `context/tickets.md`, T-015, verbatim:

> - What: `lib/portal/incident-cost.ts` prices the incidents a completed run's stored count rows carry, per `kpi-contract.md` Loss model (the ISO 45004 doc's per-injury table — fatality 1'200k flat; lost-time 56k–88k; remaining recordables, floored at zero, 15k; absent count → absent row; lost-time unknown → every recordable at the recordable row, and the report says so), constants in code citing the docx; `IncidentCostCard` renders the min–max range, the rows and the notes on the completed run page. Stored rows only — derived counts are T-016.
> - Check: (1) the four constants sit in `lib/portal/incident-cost.ts` with the doc cited, and the waterfall is code with no AI call; (2) a Nestlé `nestle.ch` cache-hit run posted with client KPIs recordables 10, lost-time 3, fatalities 0 renders `CHF 273'000 – 369'000` with three rows (fatalities 0 → 0; lost-time 3 → 168'000–264'000; remaining recordables 7 → 105'000); (3) completed run `879ae160` (web fatalities 2, no counts) renders `CHF 2'400'000` and a note that recordable and lost-time counts are not disclosed; (4) completed run `d7fd0dc7` (web recordables 150, fatalities 0, no lost-time) renders `CHF 2'250'000` and the note that every recordable is priced at the recordable row because the lost-time count is unknown; (5) the card is absent from a non-completed run's HTML; no hex or raw Tailwind colour classes; the `no-restricted-imports` boundary, `npx tsc --noEmit`, `pnpm lint`, `pnpm build` green.

## Standing facts this spec assumes

- The Later entry gated this on "the loss constants have their source doc
  in `context/product/`". `context/product/EHS Management
  System_KPIs_ISO45004.docx` is there and `kpi-contract.md` carries its
  table verbatim, so the gate is read as already met (the repo owner was
  told; no objection at the time of writing).
- `getRunKpis` returns typed `KpiRow[]` with `value: number | null`; counts
  are integers by the route's validation and stage 2's projection.
- No derived count exists yet: `lost_time_injuries` is client-only, so a
  web-only run never has one (T-016 will derive from LTIFR × hours).

## Decisions

### D1 — Constants and waterfall in `lib/portal/incident-cost.ts`

`LOSS_CHF = { fatality: 1'200'000, lostTimeMin: 56'000, lostTimeMax: 88'000,
recordable: 15'000 }`, each line citing its doc row. `buildIncidentCost(rows)`
walks the contract's waterfall in severity order and returns `null` when no
count row exists at all (nothing to price — the contract forbids inventing
one). The HCI-burn and first-aid rows are not constants: the contract keeps
them unpriced, and a constant nobody reads is a trap.

Sits in the read layer because that is where `pipeline-rules.md` puts it
("derived in code from stored rows at display time; the loss model's cost
constants live in code with cited sources"). It imports `METRIC_LABELS` from
`lib/runs/metrics.ts` — the one engine file the boundary allows — so the card
receives labels rather than metric keys; the first draft had the card import
the metrics file itself and `pnpm lint` refused it, which is the boundary
doing its job.

### D2 — `IncidentCostCard`, rendered for every completed run

Range as the title (`CHF 273’000 – CHF 369’000`; a single figure when
min = max), rows table (Category / Count / Cost), then notes: the lost-time-
unknown sentence when it applies, the unpriced counts by label, and the per-
incident rates so the reader can check the arithmetic. When the model returns
`null` the card still renders, titled "Cannot be estimated", so a completed
report never silently lacks the figure the README promises. Mounted by the
run page under the ledger only when `kpis` were read, i.e. `completed`.

`de-CH` currency formatting gives the Swiss apostrophe (U+2019) — the same
locale the ledger already uses.

Rejected: a sixth ledger row (the cost is a derived figure with its own
provenance story, not a KPI); showing a point estimate (the contract: "no
point estimate is invented").

## Verification record

2026-08-22, dev environment, `pnpm dev`, pages fetched with `curl` and user
A's minted cookie, text extracted from the HTML.

1. Constants and waterfall: `lib/portal/incident-cost.ts`, no AI import (the
   boundary rule forbids `ai`/engine modules in `lib/portal/`, lint green).
2. `a66d4e83` — Nestlé `nestle.ch` cache hit (no Parallel call) with client
   recordables 10 / lost-time 3 / fatalities 0, period 2025: "CHF 273’000 –
   CHF 369’000"; rows Fatalities 0 → CHF 0, Lost-time injuries 3 → CHF
   168’000 – CHF 264’000, Other recordable injuries 7 → CHF 105’000.
3. `879ae160` — "CHF 2’400’000"; Fatalities 2 → CHF 2’400’000; note "Not
   priced (no count disclosed or supplied): lost-time injuries, recordable
   injuries".
4. `d7fd0dc7` (Geberit) — "CHF 2’250’000"; Fatalities 0, Recordable
   injuries 150 → CHF 2’250’000; note "The lost-time count is not known, so
   every recordable injury is priced at the recordable row."
5. `c0d681c2` (`failed`) — 0 occurrences of "Annual incident cost". No hex
   in either new file; `pnpm lint`, `npx tsc --noEmit`, `pnpm build` green.

## Files

New: `lib/portal/incident-cost.ts`, `components/dashboard/IncidentCostCard.tsx`,
this spec. Changed: `app/dashboard/runs/[id]/page.tsx`,
`context/ui-registry.md`, `context/architecture.md`, `context/design.md`
(derivation rendering rule, proposed for T-016), `context/tickets.md`,
`context/log.md`.
