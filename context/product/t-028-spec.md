# T-028 spec — Display-time derivations in the ledger

Decided 2026-08-27 before any code. This file records what was decided; it
does not reopen it. The acceptance criteria are the ticket's Check, quoted
verbatim below — nothing here restates or reinterprets it.

## Acceptance criteria

From `context/tickets.md`, T-028, verbatim:

> - What: derive recordable / lost-time counts (rate × hours) and hours (from headcount) per `kpi-contract.md` Derivation rules, rendered per the approved Derived figures rule in `design.md` (≈ prefix, formula line, `derived` badge, "Derived from" source, disclosed count always wins); incident-cost card lists derived counts used.
> - Check: a run whose stored rows allow a derivation shows the ≈ row with its formula line and `derived` badge; a run with a disclosed count shows no derived duplicate; a run missing an input shows no derived row; incident-cost card shows the "Derived counts used" note only when it consumed one.

## Standing facts this spec assumes

- The rendering rule in `design.md` (Derived figures) was approved by the
  owner on 2026-08-27; the "proposed" marker is removed in this change.
- `t-006-spec.md` D4 ("the ledger shows stored rows only") is superseded by
  this ticket.

## Decisions

### D1 — Derivations live in `lib/portal/ledger.ts`

`deriveFigures(rows, headcount)` computes the three contract derivations
(recordables from TRIR × hours; lost-time from LTIFR × hours; hours from
headcount × 1'880) and both consumers — `buildLedger` and
`buildIncidentCost` — take its output, so the ledger row and the cost note
can never disagree. Counts round to the nearest integer (a fractional injury
is a rendering artifact, and the design mock shows `≈ 580`).

### D2 — Counts derive from stored rows only; no chaining

Per `design.md` ("every input is a stored row"): hours derived from headcount
renders as its own ≈ row but never feeds a count derivation. A rate feeds a
count only on the contract base — `isPerMillionHours(unit)` for disclosed
rows (the same free-text test the rank uses), or `origin === "client"`, which
is on the contract base by construction because the form asks on it.

### D3 — Headcount crosses the read-layer boundary as one scalar

`getRunHeadcount` selects `research->output->company->headcount` by JSON
path; the rest of the envelope stays engine-internal. The runs.ts boundary
comment is updated to name this one exception.

### D4 — `lost_time_injuries` gains a derived row

The client-only hidden-row rule now keeps a metric's row when a derived
figure exists for it, since the derivation gives the row honest content. The
ledger caption changes from "nothing is estimated" to naming what ≈ means —
the old sentence would have been false above a derived row.

## Verification record

2026-08-27, dev environment, `pnpm dev`, pages fetched with `curl` and a
minted owner cookie.

1. `15687402` (Nestlé cache hit posted with client TRIR 1.2 + client hours
   500'000'000; stage 3 under `FORCE_STAGE3_EMPTY`, no paid call) — ledger
   shows Recordable injuries `≈ 600` with formula `TRIR 1.2 × 500’000’000 h ÷
   1’000’000`, the `derived` badge and "Derived from TRIR and hours worked";
   the derived hours row is absent (hours are stored); the cost card reads
   CHF 11’400’000 = 2’400’000 (web fatalities 2) + 9’000’000 (600 × 15’000)
   with "Derived counts used: recordable injuries ≈ 600 (…)" and the
   lost-time-unknown note (LTIFR absent, nothing to derive from).
2. `1203b16d` (Sika) — recordables 222 disclosed: no derived duplicate; the
   only derived row is hours `≈ 63’369’160` (33'707 × 1'880); lost-time has
   no derived row (LTIFR present but hours not stored — no chaining).
3. `cd7a36c2` (Nestlé) — TRIR on base but no stored hours: no count
   derivation; hours `≈ 509’480’000` from headcount with formula, badge and
   "Derived from the disclosed headcount"; no "Derived counts used" note on
   the cost card (nothing consumed).
4. `npx tsc --noEmit`, `pnpm lint`, `pnpm build` green; no raw colours.

## Files

Changed: `lib/portal/ledger.ts`, `lib/portal/incident-cost.ts`,
`lib/portal/runs.ts`, `components/dashboard/KpiLedger.tsx`,
`components/dashboard/IncidentCostCard.tsx`,
`app/dashboard/runs/[id]/page.tsx`, `context/design.md` (proposed marker
removed), `context/tickets.md`, `context/log.md`, this spec.
