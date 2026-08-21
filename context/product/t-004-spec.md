# T-004 spec — Stage 1 company research

Decisions settled in the 2026-08-21 grill. This file records what was decided;
it does not reopen it. The acceptance criteria are the ticket's Check, quoted
verbatim below — nothing here restates or reinterprets it.

## Acceptance criteria

From `context/tickets.md`, T-004, verbatim:

> - What: Trigger.dev task — write client-KPI rows first, then cache-check by `cache_key` (copy `research` from the newest completed run under 30 days old), else call Parallel on ultra with the EHS output schema; uploaded PDF overrides any field it covers; `no_data` terminal.
> - Check: a run for a known Swiss discloser stores `research` jsonb carrying findings, `basis[]` citations, per-field confidence, and `sector`; a second run for the same company reuses the cached research and makes no Parallel call, proven from `agent_logs`; a forced task failure sets `failed` plus the `error` column plus an `agent_logs` row while the UI shows only the generic notice; a company with no web data and no upload ends `no_data`.

## Standing facts this spec assumes

Established before the grill; not re-derived here.

- T-003 shipped the trigger route, `cacheKey()`, the service-role client, the
  `create_analysis_run` transaction and the run page. T-004 imports them; it
  reimplements none of them.
- Trigger.dev is absent from `package.json`. Installing and configuring it is
  part of this ticket — there is no `trigger/` directory yet.
- `analysis_runs_cache_key_idx` already exists: `(cache_key, created_at desc)
  where status = 'completed'` — the exact shape of the cache lookup.
- `research` jsonb, `error`, `completed_at`, `processor` (default `ultra`) and
  the nine-value `run_status` enum all exist on `analysis_runs`. T-004 adds no
  column to it.
- `agent_logs` has all grants revoked from `anon`/`authenticated` and no
  policies. Only the service role writes or reads it, so the Check's "proven
  from `agent_logs`" is verified by a service-role query, never by the UI.
- Client KPI rows are already written by the trigger route inside
  `create_analysis_run` (`t-003-spec.md` D8/D9).
- No Storage bucket exists (`context/architecture.md`, "Still to come"), and no
  `uploaded_report_path` value is ever set today — the column exists, T-003
  ships no field that populates it.

## Decisions

### D1 — `eu-central-1` as the project default, and named at every trigger site

`npx trigger.dev@latest init` creates `trigger.config.ts` at the repo root with
the project ref. Project `sme24-ehs` (`proj_llpdhtuktqpldiubeqsr`) is reused —
it was created while testing the build, and nothing about it is wrong.

**Region is per-run, not per-project.** All three AWS regions are available to
every project; `region` is a `TriggerOptions` field on each trigger call, and
the project carries a *default* used when a call names none. The account
shipped with `us-east-1` as that default. It is changed to **`eu-central-1`
(Frankfurt)** — the same region as the Supabase project.

Both halves are needed, and neither is redundant:

- The **project default** makes the safe region what happens on silence, so a
  future stage that forgets the option does not quietly run in Virginia.
- The **explicit `region: 'eu-central-1'`** at each trigger site (D3) states the
  requirement in code, where a reader of the route sees it, rather than leaving
  it to a dashboard setting no diff will ever show.

The payload carries `runId`, the primary key of a row holding Swiss customer
data; run metadata, payloads and task logs all live in the orchestrator.
`context/product/pipeline-rules.md` says customer data and artifacts stay in EU
regions.

Rejected: relying on the project default alone (invisible in the repo, and one
dashboard edit away from silently moving every run); relying on the explicit
option alone (correct today, wrong the first time a stage is added without it).

Corrected from the first draft of this spec, which claimed the region is fixed
when a project is created and that moving it means a new project. Both are
false — hence no project was recreated, and `TRIGGER_API_URL` is not set: there
is one API host, and the region is a routing choice beneath it.

Local dev is `npx trigger.dev@latest dev`, which runs the tasks on this machine
against the project's dev environment; `pnpm dev` alone leaves a `queued` run
sitting there, exactly as it does today. Deploy is `npx trigger.dev@latest
deploy`, unattached to a deploy target — `tickets.md` still has "Deploy target"
under Later, and this ticket does not settle it.

Account note, outside this ticket: the org is on the Free plan with no billing
limit set. Worth setting one before the first live ultra run.

### D2 — The route enqueues with `tasks.trigger`, typed, after the write

`app/api/runs/route.ts` gains one call after `create_analysis_run` returns the
id, and nothing else changes:

```ts
await tasks.trigger<typeof companyResearchTask>("company-research", { runId }, { ... })
```

The `import type { companyResearchTask }` form is deliberate: it types the
payload without pulling task code — and the AI SDK, the Parallel client and the
service-role client behind it — into the Next.js route bundle.

The write happens first and the enqueue second. Reversed, a task could start
against a run row that does not exist yet. If the enqueue fails after a
successful write, the route returns 500 and the run stays `queued`: a visible,
recoverable state, not a lost row. It does not roll back the run — the client's
KPI figures are in it, and deleting them to report a queue error is the worse
trade.

> **Superseded by T-010 (2026-08-21).** The 500 was wrong: `queued` was called
> "recoverable" but nothing recovered it. `onFailure` and `onCancel` both need
> the task to have started, so a run that never reached a worker sat `queued`
> forever, and the 500 invited a resubmit that created a second run. The route
> now returns 201 with the `runId` whether or not the enqueue succeeded, logs a
> failed enqueue to `agent_logs`, and a scheduled sweeper re-triggers what it
> missed. See `pipeline-rules.md`, Run state machine.

Rejected: enqueuing from inside the Postgres function (Trigger.dev has no
Postgres surface); the trigger route calling AI itself (`pipeline-rules.md`
forbids it — it "validates input + ownership, then enqueues").

### D3 — Per-user concurrency 1: queue on the task, `concurrencyKey` per trigger

Split across the two sites the SDK actually requires:

```ts
// trigger/company-research.ts — the queue and its limit
queue: { name: "company-research", concurrencyLimit: 1 }

// app/api/runs/route.ts — the per-user split, and the region
{ queue: "company-research", concurrencyKey: userId, region: "eu-central-1" }
```

`concurrencyKey` creates a copy of the queue for every unique value, so each
user gets an independent sub-queue carrying the limit of 1. That is
`pipeline-rules.md`'s Quota rule exactly: "per-user Trigger.dev queue with
concurrency 1 → one run at a time per user. This is the only throttle."

**Corrected from this spec's first draft**, which had the whole
`{ name, concurrencyLimit }` object at the trigger site, following the published
docs. The installed types (`@trigger.dev/core@4.5.12`) say otherwise: at the
trigger site `queue` is a plain `string`, and `concurrencyLimit` exists only on
the task definition. The types also warn that naming a queue that does not exist
leaves runs in `PENDING_VERSION` — so the queue must be *declared* on the task
and only *referenced* when triggering. Verified against the installed
`.d.ts`, not the docs.

**A second concurrent search is accepted, not rejected.** The route validates,
writes the row, returns `runId`, and the run sits `queued` until the user's
first run finishes — then it starts on its own. No 429, no lock, no error copy.
The run page already renders the queued state (T-003 D5), so a queued second
search is a state the UI has, not a dead end. `userId` comes from the verified
session, the same value already written to `user_id`.

Rejected: a global `concurrencyLimit` in `trigger.config.ts` (throttles all
users against each other, which is not what the rule says); rejecting the second
POST with 429 (invents an error state the run state machine does not have, and
T-003's Check fixes the route's status codes at 401/400/201).

### D4 — Stage 1 trusts the client KPI rows and writes none

Step 1 of `pipeline-rules.md` stage 1 — "record client-supplied KPIs … before
the cache check" — is already satisfied when the task starts. The task reads
them and writes nothing:

```
select metric, value, period from kpis where run_id = $1 and origin = 'client'
```

The count goes to `agent_logs` at `info`. The rows themselves are needed
downstream anyway: they are an input to the `no_data` judgement (D8) and stage
2's merge reads them from the table.

`create_analysis_run` writes the run row and the client rows in one transaction,
so the rows exist or the run does not. There is no state where the task must
repair them. If the select nevertheless returns nothing for a run whose client
supplied figures, that is a bug in a transaction, and the task logs `warn`
rather than fabricating rows from a payload.

This makes an escalation re-run (`pipeline-rules.md`, Escalation — stages 1–2
re-run on ultra) trivially idempotent on this step: re-reading rows conflicts
with nothing, where re-writing them would race stage 2's atomic swap.

Rejected: carrying `clientKpis` in the task payload and upserting on
`(run_id, metric)`. `pipeline-rules.md`'s stage-1 **In** shape lists
`clientKpis?`, but that shape predates D8's decision to write them in the route;
sending them again makes the payload a second source of truth for the one class
of figure the contract says always wins, and the two can disagree. The payload
is `{ runId }` alone — everything else is read from the row (see D5). That
divergence from the contract's In shape is recorded under Doc updates.

### D5 — The payload is `{ runId }`; the task reads the row

`companyName`, `companyDomain`, `processor` and `uploadedReportPath` are columns
on a row the task must load anyway to work. Duplicating them into the payload
creates a second copy that can drift from the row — an escalation re-run, in
particular, must see the run's *current* `processor`, not the one captured when
the first attempt was enqueued.

Retries are then automatically consistent: a retried attempt re-reads the row
and sees whatever the previous attempt committed.

### D6 — Cache lookup: `cacheKey()`, newest completed under 30 days, tier-aware

The task computes the key with `cacheKey({ companyName, companyDomain })` from
`lib/runs/cache-key.ts` — the same function the route called (`t-003-spec.md`
D2). It never recomputes the rule and never reads the stored `cache_key`
column as a shortcut, so a key-rule change reaches both callers at once.

The lookup, service-role, matching the partial index exactly:

```
select id, research, processor, created_at
  from analysis_runs
 where cache_key = $1 and status = 'completed'
   and id <> $runId
   and created_at > now() - interval '30 days'
   and research is not null
 order by created_at desc
 limit 1
```

**Tier rule.** An `ultra` run ignores a donor whose `processor` is `base` and
proceeds to a fresh Parallel call, refreshing the cache with its own result. A
`base` run accepts either tier. Without this, one cheap base result shadows the
ultra default for 30 days on any previously-searched company — the reason the
rule exists (`pipeline-rules.md`, Decision log, 2026-07-13). Implemented as a
post-filter on the single fetched row, not as a second query: the newest run is
the candidate, and if its tier is wrong we call Parallel rather than reaching
further back for an older ultra result that is closer to expiry.

**What a hit copies:** the `research` jsonb, and nothing else. Not the donor's
`kpis` rows, not its `processor`, not its `completed_at`. Stage 2 then runs
normally on the copy, so this run's own client KPIs still win its own merge
(`pipeline-rules.md`, Caching). The copied jsonb gains a `cache` block naming
the donor run id and its age, so a hit is provable from the row itself and not
only from the log.

Both branches write one `agent_logs` row at `info` with `stage: 'research'` —
`cache hit` carrying `donor_run_id` and `age_days`, or `cache miss` carrying the
key and the reason (`none` | `expired` | `tier`). The Check's "makes no Parallel
call, proven from `agent_logs`" is read off exactly this pair: the second run
logs `cache hit` and logs no `parallel run created`.

Rejected: a cache table (`pipeline-rules.md`: "no cache table"); reusing the
donor's row id or pointing at it by FK (the run must own its `research` so a
donor's later deletion cannot empty a completed report).

### D7 — Parallel: create run, then the blocking-GET result loop. No webhook.

`POST /v1/tasks/runs` with `processor: 'ultra'` and a JSON output schema (D9),
then `GET /v1/tasks/runs/{run_id}/result` in a bounded loop. That endpoint
long-polls — it holds the connection server-side until the result is ready and
returns a timeout otherwise — so the "poll" is a handful of blocking reads, not
a busy wait. Loop: `timeout: 25`s per attempt, bounded so total wait cannot
exceed the task's `maxDuration`; a timeout is a retry, any other error throws to
Trigger.dev's retry policy.

Parallel receives the company name and, when supplied, the domain — public
identifiers only. No `runId`, no `user_id`, no client KPI values, no email
(`pipeline-rules.md` hard rule; `library-docs.md`, Parallel Task API). The
Parallel `run_id` is logged to `agent_logs` so a call is traceable to a
Parallel-side run without customer data leaving.

Rejected: **the webhook**. `app/api/webhooks/parallel` would need Standard
Webhooks HMAC verification (strip `whsec_`, base64-decode, HMAC-SHA256 over
`id.timestamp.rawBody`, timing-safe compare over the space-delimited
`v1,<sig>` list), the `parallel-beta: webhook-2025-08-12` opt-in header, a
public URL (a tunnel in local dev), a `parallel run_id → analysis_run`
correlation, and a Trigger.dev wait token to resume the task. That is a second
public write surface and a second failure mode, built to save compute minutes on
a workload of at most one concurrent run per user. Durable execution and retries
— the things a webhook usually buys — Trigger.dev already provides. If Parallel
run times ever make the compute cost real, the webhook is a contained change:
the create call is already isolated behind one client module.

New env: `PARALLEL_API_KEY` in `.env.example` and in the Trigger.dev
environment. The client lives in `lib/parallel/` — `lib/` is AGENTS.md's shared
infra, and the module holds the create call, the result loop and the response
types. `trigger/` holds the orchestration only.

Rejected: `parallel-web`, the vendor SDK. Two endpoints against a documented
REST API with `fetch`; the SDK's value here is the polling loop we are writing
anyway. (Revisit if the surface grows — stage 3's peer call is the next user.)

### D8 — The EHS output schema, and what `no_data` means

One JSON schema, `additionalProperties: false`, defined once in `lib/parallel/`
as the source of truth and mirrored by a Zod schema that parses the response
before anything is written. Parallel validates its own output against the JSON
schema; the Zod parse is ours, so a shape change surfaces as a task failure with
a message rather than as malformed `research` a stage 2 later trips over.

The shape, sized so T-005 can normalize it without guessing:

- `company` — `{ legal_name, headcount, country, description }`, each nullable.
  `headcount` is company context, not a KPI (`kpi-contract.md`).
- `sector` — `{ nace_code, nace_label, confidence }`, best-effort, nullable.
  Stage 3's input.
- `findings[]` — one entry per disclosed EHS figure:
  `{ metric, value, unit, basis, period, source_url, source_excerpt, confidence }`.
  `metric` is a **free-text label as disclosed**, not a canonical key: mapping to
  the canonical seven is T-005's job (`pipeline-rules.md` stage 2, "normalize to
  the canonical KPIs"), and forcing the enum here would make Parallel discard
  every figure that needs judgement to map. `basis` carries the disclosed
  denominator (e.g. `per 1'000'000 hours worked`) — `kpi-contract.md` forbids
  converting across bases, so the base must survive the hop.
- `disclosure` — `{ has_ehs_disclosure: boolean, sources_checked[], notes }`.
  The honest "we looked and found nothing" signal.

Parallel's own `basis[]` — per-field `{ field, citations[{url, title,
excerpts[]}], reasoning, confidence }` — is stored **verbatim alongside** the
parsed output, not merged into it. The Check names `basis[]` citations and
per-field confidence as things `research` must carry; keeping the provider's
array intact means provenance is never lossily re-derived.

Stored `research` jsonb:

```
{ schema_version: 1, source: 'parallel' | 'cache', fetched_at,
  output: { company, sector, findings[], disclosure },
  basis: [...],                       // Parallel's per-field array, verbatim
  parallel_run_id, processor,
  cache?: { donor_run_id, age_days }  // present only on a hit (D6)
}
```

`schema_version` is one integer, not an abstraction: `research` is a jsonb blob
read by a later stage, and the first shape change needs to be diagnosable from
the row.

**`no_data`** is a terminal, not a failure. It is set when the Parallel call
returns successfully but `findings[]` is empty *and* `has_ehs_disclosure` is
false *and* the run has no client KPI rows (D4) *and* no upload (always true
today, D10). Status `no_data`, `completed_at` set, no `error` — nothing went
wrong. `agent_logs` gets an `info` row. A run with zero web findings but client
KPIs continues to stage 2: the client gave us figures, and the report has
content. A run whose Parallel call *errors* is a failure (D11), never `no_data`
— the distinction is "we looked and there is nothing" versus "we could not
look".

### D9 — Task shape: `researching`, retries, `maxDuration`

`trigger/company-research.ts` exports `companyResearchTask`, id
`company-research`. First act: set `status = 'researching'` (the state machine's
step after `queued`), guarded so an escalation re-run does not move a run
backwards — `pipeline-rules.md` says an escalation re-run keeps the run in its
current status, and the machine only moves forward. Concretely the status write
is conditional on the current status being `queued`.

Retries: `maxAttempts: 3`, exponential backoff with `minTimeoutInMs: 60_000` —
`pipeline-rules.md` sets model-call retry backoff at ≥ 60s. `maxDuration` is set
generously enough to cover an ultra run plus retries and is the ceiling the
result loop (D7) is bounded against.

Stage 2 does not exist yet, so T-004's task ends after writing `research` and
does not chain. `triggerAndWait` to stage 2 lands in T-005, which owns reaching
`completed`. **T-004 leaves a successful run at `researching`** — an in-progress
status the state machine already has and T-006's Check requires a rendered state
for. It never writes `completed`: T-005's Check says "the run ends `completed`",
and writing it here would make a run with no `kpis` rows claim to be a finished
report.

### D10 — The uploaded-PDF override is scoped out, explicitly

T-004 ships stage 1 steps 1, 2, 3 and the `no_data` terminal. **Step 4 — the
uploaded PDF override — is not built here.** The task reads
`uploaded_report_path` from the run row and skips the override when it is null,
which it always is today.

The override needs four things that do not exist: a private Supabase Storage
bucket, an upload control on the search form, `uploaded_report_path` validated
as owned by the caller in the trigger route (`pipeline-rules.md` names this as
the route's job, and `t-003-spec.md` D3 deferred it for exactly this reason),
and a Claude PDF read merging over the web result. That is a ticket the size of
T-003, and none of it is verified by any of T-004's four Check conditions —
building it here means shipping an unverified feature inside a ticket whose
Check is already fixed.

The Check's fourth condition — "a company with no web data **and no upload**
ends `no_data`" — is satisfiable and satisfied as written: with no upload
possible, the no-upload half holds for every run (D8 evaluates it as a real
condition, not a hardcoded true, so it stays correct when the override lands).

Consequence: T-004's What is delivered minus its "uploaded PDF overrides any
field it covers" clause. A new ticket goes under `## Later` — bucket, upload
field, ownership validation, Claude PDF read — with its own Check. This is
recorded here rather than left as a silent omission; the log line for T-004
carries `deviated:`.

Rejected: building it inside T-004 (roughly doubles the ticket, reopens two
finished T-003 surfaces, and ships unverified); deleting the clause from the
ticket (only the repo owner edits a ticket).

### D11 — Failure: `onFailure` writes `failed` + `error` + one `agent_logs` row

Retries are exhausted before anything terminal happens. Trigger.dev's
`onFailure` hook fires once, after the last attempt, and is the only writer of
`failed` — `pipeline-rules.md`: "`failed` is set by the failing task's
final-failure hook (retries exhausted): write status + the `error` column + an
`agent_logs` row."

The hook writes, in one `update`: `status = 'failed'`, `completed_at = now()`,
and `error` = a short internal-facing string (error name + message, truncated).
Then one `agent_logs` row at `error` with the stage and the full payload —
message, stack, attempt count, Parallel run id when there was one.

`error` holds internals, and no read path exposes it: `lib/portal/runs.ts`
selects an explicit column list that does not include `error`, and T-006's Check
requires `failed` to show "the generic delayed notice and no internals". The
Check's "the UI shows only the generic notice" is verified against the run page
T-003 shipped, whose copy lives in the read layer.

Since the hook writes rather than throws, a hook failure cannot be retried by
Trigger.dev — so the write is defensive: a failed status write is logged to the
task logger, and never masks the original error.

Rejected: setting `failed` inside a `catch` in `run()` (fires on the first
attempt, so a run that a retry would have rescued is already marked failed, and
the retry then contradicts its own terminal status).

### D12 — Live-stack verification; no test runner in T-004

This repo has no test framework and no `test` script. T-003 was verified by
driving the real stack, and T-004 follows it: `npx trigger.dev@latest dev`
running the tasks locally against the EU project, `pnpm dev` serving the form,
and service-role SQL reading the results.

T-004 does not introduce Vitest. All four Check conditions are integration
-shaped — they name `research` contents, a cross-run cache reuse, a terminal
status set by a framework hook, and a Parallel result — and none of them closes
under a unit test. Choosing a test runner and its conventions is its own
decision, made against a seam that wants one (the loss model's arithmetic in
T-006 is the first real candidate), not smuggled into the ticket that installs
the orchestrator.

Accepted cost: the cache tier rule and the `no_data` predicate — the two pieces
of real branching logic here — are verified only through the live stack.

**The four seams, one per Check condition:**

1. *Research shape.* Run a known Swiss discloser (a listed company publishing an
   ESG/sustainability report with EHS figures) through the form. Then:
   `select research from analysis_runs where id = $1` — assert `output.findings`
   non-empty, `basis` non-empty with `citations[].url` and a `confidence` per
   entry, and `output.sector.nace_code` present.
2. *Cache hit.* Submit the same company a second time, as a second user, to
   prove the cache is shared across clients. Then
   `select stage, message, payload from agent_logs where run_id = $2` — assert
   exactly one `cache hit` row naming run 1 as `donor_run_id`, and **no**
   `parallel run created` row. Compare `research.output` between the two runs
   for equality, and check `research.cache` is present on the second only.
3. *Forced failure.* A `FORCE_STAGE1_FAILURE` env var read inside `run()`,
   throwing before the Parallel call, with `maxAttempts` temporarily at 1 so the
   hook fires immediately. Assert `status = 'failed'`, `error` non-null, one
   `agent_logs` row at `error`; then load the run page as the owner and confirm
   the generic notice with no internals. The env var is a testing seam, not
   shipped behaviour — it lives next to `PIPELINE_MODEL`, which
   `library-docs.md` already establishes as a testing-only override.
4. *`no_data`.* Submit a plausible but undisclosed company name, with no client
   KPIs, and assert `status = 'no_data'`, `completed_at` set, `error` null, and
   `research.output.disclosure.has_ehs_disclosure = false`.

## Files

New:

- `trigger.config.ts` — project ref, EU region, retry defaults
- `trigger/company-research.ts` — the stage-1 task, its `onFailure` hook
- `lib/parallel/client.ts` — create run + blocking result loop
- `lib/parallel/ehs-schema.ts` — the JSON output schema + its Zod mirror
- `lib/runs/research.ts` — cache lookup, tier rule, the `research` envelope
- `lib/runs/agent-log.ts` — the one `agent_logs` writer

Changed:

- `app/api/runs/route.ts` — the `tasks.trigger` call (D2), queue options (D3)
- `package.json` — `@trigger.dev/sdk`, `trigger.dev` (dev)
- `.env.example` — `TRIGGER_SECRET_KEY`, `PARALLEL_API_KEY`

No migration. Every column T-004 writes already exists.

## Doc updates this work obliges

- `context/product/pipeline-rules.md`, stage 1 **In** — the payload is
  `{ runId }`; `companyName`, `companyDomain`, `clientKpis` and
  `uploadedReportPath` are read from the row (D4, D5).
- `context/architecture.md` — the Pipeline section gains its first real content
  (task, queue, Parallel call, cache lookup, failure path); Data notes that
  `research` carries a `schema_version`.
- `context/library-docs.md` — Trigger.dev v4 gains the region rule (project
  default plus the explicit per-trigger option), the
  `import type` trigger convention, and the queue/`concurrencyKey` idiom;
  Parallel Task API gains the blocking-result-loop rule and the
  no-customer-data-in-payload restatement made concrete.
- `context/tickets.md` — a new ticket under `## Later` for the uploaded-report
  override, with its Check (D10).
- On completion, per AGENTS.md: a line in `context/log.md` carrying
  `deviated:` for D10, `context/ui-registry.md` updated (no components expected
  — state so if none), and T-004 removed from `context/tickets.md`.

### D13 — `onCancel` writes a terminal too; the run signal reaches Parallel

Added after a stalled dev worker left a run at `researching` with no terminal
status. The SDK docs are explicit: `onFailure` "doesn't fire for some of the run
statuses like `Crashed`, `System failures`, and `Canceled`." D11 therefore
covered only part of the space.

`onCancel` writes `failed` + `error` + an `agent_logs` row, guarded with
`.in("status", ["queued", "researching"])` so a cancellation racing a successful
write cannot overwrite a good result. It writes `failed` rather than a new
status because the run state machine has no `cancelled`, and adding one is a
schema change outside this ticket — recorded under `tickets.md` Later.

The run context's `signal` is also threaded into both Parallel `fetch` calls, so
a cancelled run aborts the in-flight request instead of leaving it hanging until
the process dies.

Neither is covered by the Check. Both were found by driving the real stack,
which is the argument D12 makes.

## Verification record

All four Check conditions verified 2026-08-21 against the live stack, per D12.

1. **Research shape** — Nestlé S.A. (`nestle.ch`), ultra. `research` carries 40
   findings, 4 `basis[]` entries citing real Nestlé PDFs, `confidence` on every
   finding and every basis entry, and `sector.nace_code = "10.89"`.
2. **Cache reuse** — a second run for the same company, **by a different user**,
   logged `cache hit` naming the donor run and age 0 days, logged no
   `parallel run created`, and stored byte-identical `output` with
   `source: "cache"` and a `cache` block. Proves the "shared across all clients"
   rule, not merely that a repeat search is cheap.
3. **Forced failure** — `FORCE_STAGE1_FAILURE=1` with `maxAttempts: 1`:
   `status = failed`, `error` populated, `completed_at` set, one `agent_logs`
   row at `error` with the stack. `lib/portal/runs.ts` selects an explicit column
   list that omits `error`, and nothing in the dashboard reads it.
4. **`no_data`** — "Brunnenhof Metallbau Wetzikon AG", no client KPIs:
   `status = no_data`, `error` null, `completed_at` set, 0 findings,
   `has_ehs_disclosure: false`, 10 sources checked. A terminal, not a failure.

**What the live data settled**, and what T-005 inherits:

- Every Nestlé rate came back on **per million hours worked** — the base
  `kpi-contract.md` fixes. The concern that Swiss disclosure might use another
  convention did not materialise here, but `findings[].basis` carries the stated
  denominator regardless, so a source on another base stays identifiable.
- Free-text `metric` (D8) was load-bearing: findings came back in units of
  "sites" and "percent" that a canonical enum would have discarded.
- Two findings carry `value: null` — a metric named without a figure. **T-005
  must skip these, never read them as zero.**
- Six years of the same metric arrive in one response. T-005 needs a
  period-selection rule; the client's `reporting_period` is the obvious key.
- Citation URLs came back `http://`. They render as client-facing sources, so
  they want normalising downstream.

## Flagged, not fixed here

Carried forward from `t-003-spec.md`, still open, still outside this ticket's
scope:

- `context/product/kpi-contract.md`'s ask-set table still shows the superseded additive
  loss ranges (`× 25–50k`, `+ 5–15k`) in its Feeds column. Its own Decision log
  replaced those with the controlled doc's per-injury table (1'200k flat,
  56–88k, 15k).
- The `kpis` table comment in `20260820114500_create_analysis_tables.sql` says
  client rows win conflicts "at write time (stage 2)", while
  `context/product/pipeline-rules.md` puts the client-KPI write in stage 1 — and
  T-003 D8 in fact put it in the trigger route, ahead of both.
