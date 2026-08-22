# T-006 spec — Dashboard report read layer

Decisions settled 2026-08-22 before any code. This file records what was
decided; it does not reopen it. The acceptance criteria are the ticket's Check,
quoted verbatim below — nothing here restates or reinterprets it.

## Acceptance criteria

From `context/tickets.md`, T-006, verbatim:

> - What: RLS-scoped read layer plus the client dashboard — run list and run detail rendering the KPI ledger with provenance, "Client-provided" markers, and a rendered state for every run status.
> - Check: the dashboard reads only through the read layer, never the engine; queued, in-progress, completed, `no_data`, and `failed` each render a distinct state, with `failed` showing the generic delayed notice and no internals; client-origin rows render "Client-provided"; another user's run URL renders not-found; `ui-registry.md` lists every component added.

## Standing facts this spec assumes

Verified against the code and migrations on 2026-08-22, not recalled.

- `public.run_status` (`20260820114500_create_analysis_tables.sql`) has exactly
  nine values: `queued`, `researching`, `extracting`, `benchmarking`,
  `matching`, `generating`, `completed`, `failed`, `no_data`. Stages 1–2 move a
  run through `queued → researching → extracting → completed`, or end it at
  `no_data` (stage 1) or `failed` (either stage's hook). `benchmarking`,
  `matching`, `generating` are reserved for stages 3–5 and nothing writes them
  today.
- `kpis` rows carry `metric`, `value numeric` (nullable), `unit`, `period`,
  `source_url`, `source_excerpt`, `confidence` (`low|medium|high`), `origin`
  (`web|upload|client`), `created_at`; `unique (run_id, metric)`. Client rows
  are written by `create_analysis_run` at `origin='client'`,
  `confidence='high'`, no `source_url`/`source_excerpt`; web rows by
  `replace_extracted_kpis` with every column filled. PostgREST returns
  `numeric` as a string.
- RLS: `authenticated` may `select` its own `analysis_runs` rows and the `kpis`
  rows of runs it owns; no policy exists on `agent_logs` and its grants are
  revoked for `anon`/`authenticated`. No write policy anywhere.
- `analysis_runs.error` is internal-facing; `t-004-spec.md` D11 and
  `architecture.md` say no read path selects it. `research` is stage-1 output
  (findings, citations, company context) — not a report surface.
- `lib/portal/runs.ts` (T-003) already holds `getRunById` selecting
  `id, company_name, company_domain, status, created_at` through
  `lib/supabase/server.ts` (the cookie-bound, RLS-scoped client), returning
  `null` for both "no such run" and "not yours".
- `app/dashboard/runs/[id]/page.tsx` calls `notFound()` on `null`. No
  `not-found.tsx` exists anywhere, so Next's default 404 renders.
- `lib/supabase/proxy.ts` redirects a signed-out GET under `/dashboard` to
  `/login?next=…`. `/auth/redirect` sends a client to `/`, with the comment
  "until the dashboard ships (T-006)"; `auth.md` Landing says the same.
- `lib/runs/metrics.ts` exports `CANONICAL_METRICS` (seven), `METRIC_LABELS`,
  `METRIC_HINTS`, `RATE_METRICS`, `COUNT_METRICS`. `kpi-contract.md` keys
  `lost_time_injuries` as client-only ("research never fills this key") and
  the other six as `web`.
- `kpi-contract.md` Show: "web metrics always render, found or an honest 'not
  disclosed'; client metrics render only when supplied. Client values are
  marked 'Client-provided'."
- `components/ui/` holds Button, Card, Field, Input, Label, Separator — no
  Table, no Badge. `components.json` is configured (style `radix-nova`).
- ESLint is flat config (`eslint.config.mjs`), `eslint-config-next` 16 +
  typescript; no custom rules yet. `no-restricted-imports` is an ESLint core
  rule and accepts gitignore-style negation inside `patterns[].group`.
- `pipeline-rules.md`: "`failed` … The UI shows a generic delayed notice,
  never the error." The copy does not exist anywhere yet.

## Decisions

### D1 — The read-layer boundary, enforced by ESLint, not convention

Three tiers, each a directory:

| Tier | Directories | May import |
|---|---|---|
| Engine | `trigger/`, `lib/parallel/`, `lib/extraction/`, `lib/runs/{agent-log,research,queues,cache-key}.ts`, `lib/supabase/service.ts` | anything |
| Read layer | `lib/portal/` | `lib/supabase/server.ts`, `lib/runs/metrics.ts`, `server-only` |
| Dashboard | `app/dashboard/`, `components/dashboard/` | `lib/portal/`, `lib/utils.ts`, `components/ui/`, `next/*`, `react`, `lucide-react` |

`lib/runs/metrics.ts` is the contract's constant list, not engine code — the
form, the route, the extractor and now the ledger all key on it, and the
ledger's metric labels have no other home. Everything else under `lib/runs/`
is pipeline plumbing and stays on the engine side.

Enforcement is two `no-restricted-imports` blocks in `eslint.config.mjs`:

- `files: ["app/dashboard/**", "components/dashboard/**"]` — restricted
  patterns: `@/lib/*` with negations for `@/lib/portal`, `@/lib/portal/*`,
  `@/lib/utils`; plus `@/trigger/*`, `@/actions/*`, `@trigger.dev/*`, `ai`,
  `@supabase/*`. The dashboard cannot reach a Supabase client at all, so "reads
  only through the read layer" is structural: there is no way to issue a
  query from a dashboard file that lint accepts.
- `files: ["lib/portal/**"]` — restricted: `@/trigger/*`, `@/lib/parallel/*`,
  `@/lib/extraction/*`, `@/lib/supabase/service`, `@/lib/runs/*` with a
  negation for `@/lib/runs/metrics`, `@trigger.dev/*`, `ai`.

`pnpm lint` is already a handoff gate (AGENTS.md), so a bad import fails the
same check every handoff runs. The read layer also imports `server-only`, so
a Client Component importing it fails the build.

Rejected: a convention comment (what T-003 left; the Check says "only", which
a comment cannot prove); `eslint-plugin-boundaries` or `import/no-restricted-
paths` (a new dependency for two rule blocks); a custom script walking
imports (re-implements what the core rule does).

### D2 — RLS is the authority; the read layer never filters by user

Every read goes through `lib/supabase/server.ts`, the cookie-bound client, so
`auth.uid()` in the two owner policies decides which rows exist. `listRuns()`
has no `user_id` predicate and `getRunById(id)` has only `id`; a run the caller
does not own is a zero-row result, which the page turns into `notFound()`. The
read layer has no notion of "forbidden": it cannot tell another user's run
from a nonexistent one and is not allowed to try. This is `auth.md`'s layer
split — "RLS guards data, proxy guards pages" — and T-003's D5 unchanged.

Column lists are explicit and never include `error`, `research`, `cache_key`,
`processor` or `uploaded_report_path`. The read layer is the only place the
dashboard can get a row from, so "no internals" is a property of three
`select()` strings.

Rejected: `getUser()` in the page plus `eq("user_id", user.id)` (a second
check that can only disagree with RLS, and a page that "knows" about ownership
— the thing T-003's D5 comment forbids); a 403 branch (requires the page to
learn the run exists).

### D3 — Nine enum values, five render states, one exhaustive map

`lib/portal/run-state.ts` exports `runState(status): RunState` as a
`Record<RunStatus, RunState>` so TypeScript fails the build if the enum and
the map ever disagree:

| `run_status` | State | Renders |
|---|---|---|
| `queued` | `queued` | "Queued" — the T-003 copy, unchanged |
| `researching`, `extracting`, `benchmarking`, `matching`, `generating` | `in_progress` | "In progress — researching public disclosures and extracting KPIs. Refresh in a minute." |
| `completed` | `completed` | the KPI ledger (D4) |
| `no_data` | `no_data` | "Nothing public found — we found no EHS disclosures for this company and no figures were supplied." |
| `failed` | `failed` | "Delayed — this analysis hit a problem on our side. It has been logged and we will look into it; check back later." |

The three stage-3–5 statuses map to `in_progress` now so the map is total; a
later ticket can split them without touching this one's states. The state,
not the raw status, is what components switch on — one `switch` over five
values, each branch a distinct block with its own icon and token
(`text-primary` queued/in-progress, `text-success` completed,
`text-muted-foreground` no_data, `text-warning` failed).

`failed` reads nothing beyond `status`: the read layer does not select
`error`, `agent_logs` has no client grant, and the copy is a string literal in
the component. The verification greps the rendered HTML for `268cca06`'s
`error` text ("non-canonical metric rejected") to prove it.

No polling and no realtime: nothing in the Check asks for it, and
`trigger-realtime-and-frontend` is the Trigger.dev surface — a client
dependency on the engine's run ids. The in-progress copy tells the user to
refresh.

Rejected: a sixth state for "partial" (T-005 returns `completed` with zero web
rows — the ledger's "Not disclosed" rows say that honestly); `error`-derived
hints for `failed` (the contract forbids it).

### D4 — The ledger: seven contract rows, client rows marked, nothing derived

`lib/portal/kpis.ts` exports `getRunKpis(runId): Promise<KpiRow[]>` selecting
`metric, value, unit, period, source_url, source_excerpt, confidence,
origin`, with `value` coerced from PostgREST's string to `number | null` and
`metric` narrowed to `CanonicalMetric` (a row outside the list — impossible by
T-005's gate — is dropped, not thrown, so one bad row cannot blank a report).

`lib/portal/ledger.ts` exports `buildLedger(rows): LedgerRow[]`: one row per
canonical metric in contract order, joined to the stored row by metric.

| Column | Source | Empty renders as |
|---|---|---|
| Metric | `METRIC_LABELS[metric]` + `METRIC_HINTS[metric]` as the sub-line | — |
| Value | `Intl.NumberFormat("de-CH")` (the contract's 1'000'000 style), then `unit` | "Not disclosed" |
| Period | `period` | "—" |
| Confidence | `confidence` as a Badge: `high` success, `medium` warning, `low` muted | — |
| Source | `source_url` as an external link (hostname as text, `rel="noreferrer"`, opens in a new tab) and `source_excerpt` as a quoted line beneath | "Client-provided" for `origin='client'`; "—" otherwise |

`kpi-contract.md` Show decides which metrics appear without a row: the six
`web` metrics always render (found or "Not disclosed"); `lost_time_injuries`
is client-only and appears only when a client row exists. `origin='upload'`
renders as a source like `web` (it is a citation either way); nothing today
writes it.

The "Client-provided" marker is in the Source column because that is the
provenance slot — a client figure has no URL and no excerpt, and the marker
is what replaces them. The Check's wording ("client-origin rows render
'Client-provided'") is met by the literal string in the rendered row.

**Derived metrics: none.** `kpi-contract.md` Derivation rules lists recordable
and lost-time counts from rate × hours, hours from headcount, peer rank, and
the annual incident cost. Annual incident cost is explicitly Later
(`tickets.md`: "once the loss constants have their source doc"). The rate ×
hours derivations are not in the Check either, and rendering one means
rendering it "flagged with its formula and an ≈" — a display rule that has no
agreed design yet. The ledger shows stored rows only; the derivations go under
Later as one note (Doc updates below).

Rejected: hiding undisclosed web metrics (the contract says "an honest 'not
disclosed'"); a card grid instead of a table (the ledger is a table of
provenance — seven rows × five columns read as a table, and `design.md` calls
it "a KPI ledger"); computing the recordable count now (scope beyond the
Check).

### D5 — Routes: `/dashboard` (run list) and `/dashboard/runs/[id]` (detail)

- `app/dashboard/page.tsx` — Server Component; `listRuns()` → `RunList`.
  Empty list renders a prompt with a link to `/` (the search form stays on
  `/`, T-003). A "New search" link sits in the page header either way.
- `app/dashboard/runs/[id]/page.tsx` — exists; gains `getRunKpis` when the
  state is `completed` and renders `RunStatusCard` + `KpiLedger`. Still
  `notFound()` on `null`.
- `app/dashboard/layout.tsx` — one container (`max-w-5xl`) and a back link
  on the detail page; nothing else. No sidebar: `design.md`'s sidebar tokens
  are "reserved" and a two-page surface does not need one.
- `app/dashboard/not-found.tsx` — the not-found state in the app's own chrome
  ("No such analysis" + link to `/dashboard`). The Check says "renders
  not-found"; Next's default 404 satisfies it but ignores the design tokens
  (`not-found.md`: "does not read an app-level theme"). One small file.

Auth gate per `auth.md`: the proxy redirects signed-out requests under
`/dashboard` to `/login?next=…` (already true); the pages then read through
the session client and RLS scopes the rows. No role check: the dashboard is
the client surface and every role is also a client of its own runs.
`/auth/redirect`'s client target flips from `/` to `/dashboard`, which
`auth.md` Landing and the handler's own comment already promise for T-006.

`metadata.robots` noindex on both pages, as on the existing run page. Both are
dynamic by construction (cookies), no `revalidate`.

Rejected: folding the list into `/` (the marketing page is not behind the
proxy's gate and should not grow a data read); `/dashboard/runs` as the list
URL (`/dashboard` is the name every doc already uses).

### D6 — Components: two primitives, three composites, one extended

All server components; no `"use client"` anywhere in this ticket — there is
no state, no effect, no browser API. Matched against `ui-registry.md` first:
Card, Button/`buttonVariants` reused.

Primitives, added through the shadcn CLI (`pnpm shadcn add table badge`) so
they are the registry's own code:

- `Table` (`components/ui/table.tsx`) — `Table`, `TableHeader`, `TableBody`,
  `TableRow`, `TableHead`, `TableCell`, `TableCaption`.
- `Badge` (`components/ui/badge.tsx`) — `variant` default|secondary|
  destructive|outline|ghost|link; the dashboard adds no variants and colours a badge with
  semantic text/bg classes on top of `outline`.

Composites (`components/dashboard/`):

- `RunStatusBadge` — `status: RunStatus`; renders the state's label as a
  Badge with its token. Shared by the list and the detail card, so the two
  surfaces cannot disagree on a label.
- `RunList` — `runs: Run[]`; a Table of company, status badge, date, each row
  linking to its detail page. Renders the empty prompt itself when `runs` is
  empty (slot-free: the empty copy is part of the component's contract, not
  the page's).
- `KpiLedger` — `rows: LedgerRow[]`; the table from D4. No children.
- `RunStatusCard` (changed) — `run: Run`; the T-003 card now switches over
  `runState(run.status)` and renders the five blocks from D3. No slots: the
  ledger is rendered by the page beneath the card, not inside it, so the card
  owns status and the ledger owns data.

Tokens only (`design.md`): `text-success` for completed, `text-warning` for
failed, `text-primary` for queued/in-progress, `text-muted-foreground` for
`no_data` and "Not disclosed". No new tokens, no hex, no raw Tailwind colours.

Rejected: a `StatusNotice` primitive with icon/title/body slots (one consumer
today — a premature abstraction); `Alert` from shadcn (the failed notice is a
status block like the other four, not an alert).

### D7 — Live-stack verification, one seam per Check clause

Same posture as `t-004-spec.md` D12 / `t-005-spec.md` D8: no test runner, the
real stack (`pnpm dev` + the EU project), signed-in browser sessions for two
test users. Recorded in the Verification record with run ids.

1. *Reads only through the read layer.* Add `import { createServiceClient }
   from "@/lib/supabase/service"` to `components/dashboard/KpiLedger.tsx`,
   run `pnpm lint`, record the `no-restricted-imports` error, revert. Repeat
   with `@/trigger/kpi-extraction` from `app/dashboard/page.tsx`.
2. *Five distinct states.* `2a456942` (completed), `268cca06` (failed), the
   T-004 `no_data` run (Brunnenhof Metallbau Wetzikon AG), a fresh run caught
   at `queued` and again at `researching`/`extracting`. Each page's rendered
   HTML carries its state's heading and none of the others'.
3. *Failed shows no internals.* `curl` the `268cca06` page with the owner's
   session cookie; grep the HTML for `non-canonical`, `headcount`, `error` —
   zero hits; the delayed notice present.
4. *Client-provided.* `8e6facc4`: three rows (TRIR, fatalities, hours worked)
   show "Client-provided" in the Source column; the web LTIFR row written
   during T-005's D4 check, if still present, shows its link.
5. *Another user's run is not-found.* The second T-004 test user, signed in,
   opens `/dashboard/runs/2a456942…` → 404 with the not-found page; their own
   `/dashboard` list does not contain it.
6. *Registry.* `ui-registry.md` diff lists Table, Badge, RunStatusBadge,
   RunList, KpiLedger and the changed RunStatusCard, plus the two pages.

Then `npx tsc --noEmit`, `pnpm lint`, `pnpm build`.

## Files

New:

- `lib/portal/kpis.ts` — `getRunKpis`, `KpiRow`
- `lib/portal/ledger.ts` — `buildLedger`, `LedgerRow`
- `lib/portal/run-state.ts` — `RunState`, `runState`, `RUN_STATE_LABELS`
- `components/ui/table.tsx`, `components/ui/badge.tsx` — shadcn
- `components/dashboard/RunStatusBadge.tsx`, `RunList.tsx`, `KpiLedger.tsx`
- `app/dashboard/page.tsx`, `app/dashboard/layout.tsx`,
  `app/dashboard/not-found.tsx`

Changed:

- `lib/portal/runs.ts` — `listRuns`, `server-only`
- `components/dashboard/RunStatusCard.tsx` — five states (D3)
- `app/dashboard/runs/[id]/page.tsx` — ledger on `completed`
- `app/auth/redirect/route.ts` — client target `/dashboard` (D5)
- `eslint.config.mjs` — the boundary (D1)

## Assumptions

- The existing runs named in the Check (`2a456942`, `268cca06`, `8e6facc4`,
  the T-004 `no_data` run) still exist in the EU project under the first test
  user, and the second T-004 test user can still sign in.
- A fresh queued/in-progress run needs `npx trigger.dev@latest dev` running
  to advance; catching `queued` needs only the route.

## Doc updates this work obliges

- `context/architecture.md` — Surfaces gains the dashboard and the three-tier
  import boundary (D1); Auth / RLS Landing target becomes `/dashboard`.
- `context/product/auth.md` — Landing: drop the "until T-006" clause.
- `context/ui-registry.md` — D6's components and the two pages.
- `context/tickets.md` — T-006 removed; Later gains "Display-time derivations
  (recordable / lost-time counts from rate × hours, hours from headcount) with
  the ≈ + formula rendering rule" as a note.
- `context/log.md` — one line.
