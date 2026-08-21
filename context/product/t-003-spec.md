# T-003 spec — Search form + trigger route

Decisions settled in the 2026-08-21 grill. This file records what was decided;
it does not reopen it. The acceptance criteria are the ticket's Check, quoted
verbatim below — nothing here restates or reinterprets it.

## Acceptance criteria

From `context/tickets.md`, T-003, verbatim:

> - What: Search form (company name, optional domain, the 7 optional KPI fields) posting to a route handler that validates auth, input shape, and ownership, inserts a `queued` `analysis_runs` row with its normalized `cache_key`, and returns `runId`. No pipeline call yet.
> - Check: unauthenticated POST → 401; malformed body or a duplicate metric → 400 with a generic message; valid POST → exactly one `analysis_runs` row (`queued`, normalized `cache_key`) and a returned `runId`; the KPI fields validate against the canonical list in `kpi-contract.md`; submitting lands on the run's dashboard page showing the queued state.

## Standing facts this spec assumes

Established before the grill; not re-derived here.

- Trigger.dev is not in `package.json`, so "no pipeline call yet" is forced. A
  `queued` run cannot advance until T-004 — the landing page needs no polling
  and no realtime.
- `analysis_runs.cache_key` is `not null check (length(cache_key) > 0)`, with no
  default and no generated column. The route computes it.
- `grant insert on analysis_runs` exists only for `service_role`;
  `authenticated` holds `select` only (`20260821090607_revoke_anon_select_on_analysis_tables.sql`).
  The insert needs a service-role client, which does not exist yet.
- No Storage bucket exists (`context/architecture.md`, "Still to come"), so there is no
  `uploaded_report_path` to validate.

## Decisions

### D1 — Form posts to a route handler, not a Server Action

`app/api/runs/route.ts` is the only entry point. A client component posts to it
with `fetch`, reads `runId` from the JSON, and navigates to the run page.

`context/product/pipeline-rules.md` names the surface ("Trigger route (`app/api/`)"), and the
Check is written in HTTP status codes, which a Server Action returning a value
cannot produce without reinterpretation — and `docs/agents/issue-tracker.md`
forbids the doer from reinterpreting a Check. Security does not separate the
options: Next 16's forms guide states a Server Action "is reachable to anyone
who can send the same POST."

Accepted cost: no progressive enhancement. The form requires JavaScript.

Rejected: a Server Action in `actions/`; a route handler plus a thin action
wrapper (two entry points for one operation, which AGENTS.md's ban on
speculative indirection rules out).

### D2 — `cache_key` normalization lives in `lib/runs/cache-key.ts`

One exported function, `cacheKey({ companyName, companyDomain })`. Both
`app/api/` and `trigger/` import it, so T-004 reproduces the key by calling the
same code rather than re-implementing the rule.

The rule, in order:

1. NFC-normalize the input.
2. Trim, lowercase, collapse inner whitespace to single spaces.
3. Domain branch only: strip scheme, a leading `www.`, any path, query or
   fragment, any port, and one trailing dot. Parse with `URL` rather than a
   regex; if it will not parse, fall back to the name branch.
4. Key = normalized domain when a domain was supplied, else normalized name.

NFC is first because without it the same company typed on macOS and on Windows
produces two keys and silently misses cache — a paid Parallel call that should
have been a hit.

`lib/` is AGENTS.md's shared infra. Placing the function in `trigger/` was
rejected: the route would then import from the task directory, inverting the
dependency, and `trigger/` does not exist yet.

Consequence: this rule is longer than the one-line version in
`context/product/pipeline-rules.md`. That file's Caching section is updated to match (see
Doc updates).

### D3 — Ownership is the session; the service-role client widens to `app/api/`

"Validates ownership" binds to `user_id`: it is read from the verified session
and never from the request body. A body carrying `user_id` is rejected as
malformed, not silently ignored.

No `uploaded_report_path` field ships in T-003. `context/product/pipeline-rules.md` defines it
as "owned by the caller", but with no Storage bucket there is nothing to
validate against, and shipping an unvalidatable ownership field is the hole the
Check asks to close.

`context/library-docs.md` scoped the service-role client to `trigger/` +
`app/api/webhooks/`, while `context/architecture.md` already commits T-003's route to
using it. The contradiction resolves in favour of `context/architecture.md`: the route
has no alternative, since `authenticated` cannot insert. `context/library-docs.md` and
the comment in `lib/supabase/server.ts` are updated to name `app/api/` as a
permitted caller (see Doc updates).

New file: `lib/supabase/service.ts`, using the `sb_secret_…` key per the
existing env convention.

Rejected: granting `authenticated` an insert with a `with check` policy. It
reopens client-side writes and contradicts "writes happen only through the
service role."

### D4 — `kpis[]` on the wire, seven named fields in the UI

Confirmed: the route accepts an array while the form renders seven fields. This
is `context/product/pipeline-rules.md`'s stated shape ("optional `kpis[]` — canonical metrics,
deduped by metric") and `context/product/kpi-contract.md`'s ask set of seven optional fields.
The form contributes an entry only for a field the client filled.

Metric keys are exactly the canonical identifiers: `TRIR`, `LTIFR`,
`total_recordable_injuries`, `lost_time_injuries`, `fatalities`, `near_misses`,
`hours_worked`.

"A duplicate metric" means the array carries the same `metric` twice. The form
cannot produce this; the route is a public POST, so it is validated anyway —
array length compared against the size of the set of metrics, mismatch → 400.

An empty `kpis[]` and an omitted `kpis` are equivalent, both meaning no client
KPIs.

`reporting_period` is one form field, not an eighth metric: `context/product/kpi-contract.md`
defines the reporting period as "a qualifier on all seven, not a metric of its
own." It supplies each written row's `period`.

### D5 — Minimal landing page, reading through a new `lib/portal/`

`app/dashboard/runs/[id]/page.tsx` is a Server Component rendering the company
name and a queued state. It reads through a new run-by-id function in
`lib/portal/`, RLS-scoped via the existing cookie-bound client.

T-006 owns run detail, and its Check also covers the queued state, so the two
Checks overlap on exactly one state. Reading Supabase directly from the page
would satisfy T-003 while creating something T-006's Check forbids ("reads only
through the read layer, never the engine"). Creating the read layer now means
T-006 extends it instead of replacing it, and no intermediate state contradicts
a Check.

Accepted cost: `lib/portal/` is scope beyond T-003's literal What.

Rejected: deferring the page entirely to T-006, which would leave T-003's Check
unsatisfiable as written — and only the repo owner edits a Check.

### D6 — `{ error: string }` on every error response

401 and 400 both return a single human-readable sentence. No field-level detail
crosses the wire; the Check says "generic message" and AGENTS.md says API errors
return generic messages with stable status codes.

Field-level recovery is handled client-side with HTML5 validation attributes
(`required`, `type="number"`, `min`), so ordinary mistakes never reach the
server.

### D7 — Values are numbers, never coerced

The route validates with `z.number()` — no `z.coerce`. Every metric is
non-negative; the five counts (`total_recordable_injuries`,
`lost_time_injuries`, `fatalities`, `near_misses`, `hours_worked`) are integers;
`TRIR` and `LTIFR` stay floating point.

The form omits a blank field rather than sending an empty string. This is the
decisive point: `z.coerce.number()` turns `""` into `0`, which would record
zero fatalities as a client-supplied fact at `confidence: 'high'` — a fabricated
disclosure, which `context/product/pipeline-rules.md` forbids ("never present a guessed number
as fact").

### D8 — The route writes the client KPI rows

The valid POST writes the `analysis_runs` row and the client-supplied `kpis`
rows together, each with `origin: 'client'`, `confidence: 'high'`, and `period`
from the form's reporting period.

There is nowhere else for these values to live today: no intake column exists on
`analysis_runs`, and `research` is stage-1 output rather than intake. The unique
constraint `(run_id, metric)` already enforces one row per metric.
`context/product/pipeline-rules.md` stage 1 step 1 requires client KPIs to exist before the
cache check; writing them here satisfies that in advance.

Note for review: the ticket's What says "inserts a `queued` `analysis_runs`
row", and the Check counts only that row. The KPI write is unstated but forced.

Rejected: adding an intake jsonb column, which would store the same data twice.

### D9 — Both writes go through one Postgres function

A new migration adds `create_analysis_run(...)`, called with `.rpc()`, inserting
the run row and the client KPI rows in a single transaction and returning the
run id.

PostgREST offers no client-side transaction, so two `.insert()` calls can fail
between the first and the second, leaving a `queued` run whose client KPIs are
missing. T-004 would then research that run as though the client supplied
nothing, and the client's own figures — which the contract says win every
conflict — would be silently dropped from the report. A partial failure of that
kind still satisfies the Check's "exactly one `analysis_runs` row" while being
wrong.

`security definer` is not needed: the service role already holds insert on both
tables.

Rejected: a compensating delete (can itself fail, leaving the orphan it was
meant to prevent); accepting partial failure.

## Files

New:

- `app/api/runs/route.ts` — the trigger route
- `app/dashboard/runs/[id]/page.tsx` — the landing page
- `lib/runs/cache-key.ts` — `cacheKey()`, shared with T-004
- `lib/supabase/service.ts` — service-role client
- `lib/portal/` — run-by-id read
- a search form component under `components/` (surface folder per AGENTS.md)
- one migration adding `create_analysis_run`

Changed:

- `lib/supabase/server.ts` — the comment scoping the service-role client

## Doc updates this work obliges

- `context/product/pipeline-rules.md`, Caching — the normalization rule per D2.
- `context/library-docs.md`, Supabase — service-role scope gains `app/api/` per D3.
- On completion, per AGENTS.md: a line in `context/log.md`, `context/ui-registry.md`
  updated with every component added, and T-003 removed from
  `context/tickets.md`.

## Flagged, not fixed here

Surfaced during the grill; outside T-003's scope, recorded per
`docs/agents/domain.md`'s instruction to flag conflicts rather than override
them.

- `context/product/kpi-contract.md`'s ask-set table still shows the superseded additive loss
  ranges (`× 25–50k`, `+ 5–15k`) in its Feeds column. Its own Decision log
  replaced those with the controlled doc's per-injury table (1'200k flat,
  56–88k, 15k).
- The `kpis` table comment in `20260820114500_create_analysis_tables.sql` says
  client rows win conflicts "at write time (stage 2)", while
  `context/product/pipeline-rules.md` puts the client-KPI write in stage 1.
