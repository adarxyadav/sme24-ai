# T-005 spec — Stage 2 KPI extraction

Decisions settled 2026-08-21 before any code. This file records what was
decided; it does not reopen it. The acceptance criteria are the ticket's Check,
quoted verbatim below — nothing here restates or reinterprets it.

## Acceptance criteria

From `context/tickets.md`, T-005, verbatim:

> - What: Trigger.dev task normalizing stage-1 research into canonical `kpis` rows via `Output.object` + Zod, written as one atomic swap that touches only non-client rows. The run reaches `completed` after this stage until stages 3–5 land.
> - Check: rows carry metric, value, unit, period, source_url, source_excerpt, confidence, and origin; client rows survive a forced retry unchanged and win every conflict; no metric outside the canonical list is ever written; the run ends `completed`.

## Standing facts this spec assumes

Established by T-003/T-004/T-010; not re-derived here.

- Stage 1 (`trigger/company-research.ts`) leaves a successful run at
  `researching` with `research` jsonb written, and never writes `completed`
  (`t-004-spec.md` D9). `no_data` is its own terminal and never reaches stage 2.
- `research.output.findings[]` is `{ metric (free text), value (nullable), unit,
  basis, period, scope, source_url, source_excerpt, confidence }` — the Zod
  mirror in `lib/parallel/ehs-schema.ts`. Two live facts from T-004's
  verification record: some findings carry `value: null` (a metric named
  without a figure) and several years of one metric arrive in one response.
- Client KPI rows already exist (`origin: 'client'`, `confidence: 'high'`,
  `period` = the form's reporting period or null), written by the trigger route
  inside `create_analysis_run`. Stage 1 reads them and writes none.
- `kpis` has `unique (run_id, metric)`, so one metric per run, full stop — the
  conflict the Check names is a real constraint, not a convention.
- `lib/runs/metrics.ts` exports `CANONICAL_METRICS` (the ask-set seven) and is
  already what the route validates against.
- `analysis_runs_cache_key_idx` is partial on `status = 'completed'`: a run
  becomes a cache donor only when stage 2 finishes it.
- No AI SDK is installed. `pipeline-rules.md` Stack fixes the model layer:
  Vercel AI SDK + AI Gateway, `anthropic/claude-sonnet-5`, `PIPELINE_MODEL`
  override for testing. No `AI_GATEWAY_API_KEY` exists in `.env.local` today.

## Decisions

### D1 — Handoff is `triggerAndWait`; the run is `extracting` meanwhile

Stage 1, after writing `research` on a non-`no_data` run, calls
`kpiExtractionTask.triggerAndWait({ runId }, { region: "eu-central-1" })` and
returns its result alongside its own. That is the contract's word
(`pipeline-rules.md`, Stages: "stages chain via `triggerAndWait`"), and it is
also what the deferred escalation (D7) needs: a parent that waits gets stage
2's `{ webNumericCount }` back and is the only place that can decide to re-run
stages 1–2.

What the wait costs and why it is acceptable:

- A parent waiting on a child on a *different* queue checkpoints and **releases
  its concurrency slot** (Trigger.dev docs, queue-concurrency). So while run A
  is in stage 2, the same user's queued run B can start stage 1. The Quota rule
  ("one run at a time per user") is therefore exact for the paid Parallel call
  — still one per user at a time — and approximate across the whole pipeline
  for the ~30 s an extraction takes. Putting stage 2 on the per-user queue
  instead would make run B's stage 1 (enqueued earlier, FIFO) jump ahead of run
  A's stage 2, stalling A behind a full ultra run. Wrong trade.
- Wait time does not count toward stage 1's `maxDuration` (docs, max-duration:
  `triggerAndWait` is excluded), so the 1800 s ceiling is untouched.
- Stage 2 runs on its own default queue with no concurrency key. Its work is
  one model call; nothing about it needs throttling per user.

**A child failure is not a parent failure.** `triggerAndWait` returns
`{ ok: false }` after stage 2's retries are exhausted; stage 1 logs it at
`warn` and returns normally. It must not throw: a stage-1 retry would re-run
the Parallel call on a run whose research is already stored — a second paid
call to recover from a model failure that stage 2's own hook has already
recorded as `failed` (D6).

**Status.** Stage 2's first act is `researching -> extracting`, conditional:
`update ... where id = $1 and status in ('researching', 'extracting')`. The
`extracting` branch makes a retried attempt idempotent; zero rows updated means
the run is terminal or elsewhere in the machine and the task throws rather than
writing KPIs onto a finished or failed run. Its last act is `completed` +
`completed_at`, from `extracting` only. The machine only moves forward, and
this task moves it exactly two steps.

Rejected: a fire-and-forget `trigger` from stage 1 (cheaper, but the contract
says `triggerAndWait`, and the escalation in D7 has no parent to return to);
calling extraction inline in stage 1 (`pipeline-rules.md` Decision log, "Stages
1+2 stay separate").

### D2 — The atomic swap is a Postgres function, `replace_extracted_kpis`

```sql
replace_extracted_kpis(p_run_id uuid, p_kpis jsonb) returns integer
```

In one plpgsql body, hence one transaction:

1. `delete from kpis where run_id = p_run_id and origin <> 'client'`
2. `insert ... select ... from jsonb_array_elements(p_kpis) k where not exists
   (select 1 from kpis c where c.run_id = p_run_id and c.metric = k->>'metric')`
3. return the inserted count.

Why a function and not two PostgREST calls: PostgREST has no client-side
transaction, so a delete that commits before an insert that fails leaves a run
with no web rows and no error — the exact shape `create_analysis_run` was
written to prevent for the client rows (`t-003-spec.md` D9). The function
also makes "touches only non-client rows" a property of the SQL rather than of
every caller: the delete has `origin <> 'client'` in its predicate, and the
insert's anti-join means a client row is never even attempted, so the unique
constraint is never the thing that saves the client value. Client rows keep
their `id` and `created_at`, which is how "survive unchanged" is verified.

Same privilege model as `create_analysis_run`: not `security definer`, execute
revoked from `public`/`anon`/`authenticated`, granted to `service_role`.

Rejected: a transaction via a direct Postgres connection from the task (a
second database client and a second credential for one write); delete-then-
insert from the task (the unguarded gap above); upsert on `(run_id, metric)`
with `origin <> 'client'` in the conflict clause (does not remove web rows a
retry no longer produces, so a retry could leave a stale metric behind).

### D3 — The Zod schema: the model maps, code copies

`lib/extraction/schema.ts`:

```ts
export const WEB_EXTRACTABLE_METRICS = CANONICAL_METRICS.filter(m => m !== "lost_time_injuries")

export const kpiExtractionSchema = z.object({
  kpis: z.array(z.object({
    metric: z.enum(WEB_EXTRACTABLE_METRICS),
    finding_index: z.number().int().nonnegative(),
    rationale: z.string(),
  })),
})
```

The canonical list has one source: `lib/runs/metrics.ts`. The enum is derived
from it, so a metric added to the contract reaches the route, the form and the
extractor from one edit, and a metric outside it fails validation before
anything is written. `lost_time_injuries` is removed because
`kpi-contract.md` says so explicitly: "Web extraction folds lost-time data under
LTIFR, so research never fills this key."

**The model picks a finding; it does not retype figures.** Each entry names
the stage-1 finding (by index into `research.output.findings`) that is this
company's best figure for that canonical metric, plus a one-line rationale
(logged, never shown). Code then builds the row from the finding:

| Row column | From |
|---|---|
| `metric` | the model's canonical key |
| `value` | `finding.value` — a null value is rejected in code (T-004: "must skip these, never read them as zero") |
| `unit` | rates: `finding.basis ?? finding.unit` (the disclosed denominator, so a non-standard base stays visible per `kpi-contract.md`); counts: `finding.unit ?? "count"`, `hours_worked`: `"hours"` |
| `period` | `finding.period` |
| `source_url`, `source_excerpt` | the finding's, verbatim |
| `confidence` | `finding.confidence` |
| `origin` | `'web'` — the only origin stage 2 writes today (D5) |

This is "math is code, judgment is AI" applied to extraction: the judgment is
which disclosed label means TRIR and which year to take; the number, the quote
and the URL are never generated, so a figure can only come from a finding
Parallel cited. A `finding_index` out of range, a duplicate metric, or a
finding with a null value fails the attempt in code.

**Period rule.** The prompt tells the model: prefer the finding whose period
matches the client's reporting period when the client rows carry one; else the
most recent period; prefer `employees` scope over `combined` over null; never
pick a rate whose basis is not per 1'000'000 hours when a same-period finding
on that basis exists. Metrics the client already supplied are listed as
"do not fill" so the model spends no judgment on them — but D4 makes the DB
the enforcement, not the prompt.

Rejected: having the model emit `value`/`unit`/`source_excerpt` itself (a
retyped number is a guessed number; `pipeline-rules.md` hard rule); a schema
covering the contract's three web-only lagging indicators (`severity_rate`,
`occupational_illness_rate`, `enforcement_actions`) — see Open questions.

### D4 — Client rows win in three places; the DB is the one that counts

1. The prompt excludes client metrics (saves tokens, nothing more).
2. The task drops any extracted metric that is also a client metric before
   calling the function, and logs the drop.
3. `replace_extracted_kpis`'s anti-join (D2) refuses the insert regardless.

Only (3) is load-bearing. (1) and (2) exist so the normal path never relies on
the constraint, but the Check's "win every conflict" is proven against (3): the
forced-retry seam (D8) replays the swap and the client row's `id`,
`created_at`, `value`, `period`, `confidence` and `origin` are compared
byte-for-byte before and after.

### D5 — A cache-hit run goes through extraction like any other

Stage 2 reads `research` from the run row and client rows from `kpis` for the
*current* run. It never looks at the donor: a cache hit copied the jsonb
(`t-004-spec.md` D6), so the input is already on the row, and the client rows
were written by this run's own `create_analysis_run`. The donor's `kpis` are
not copied and not consulted — they belonged to another client's merge.
Consequence: the same research extracts twice (one model call per run, not per
company), which is the cost `pipeline-rules.md` Caching accepts: "stage 2 runs
normally on the copy (so the current run's client-KPI merge still applies)."

`origin` is `'web'` whether `research.source` is `parallel` or `cache` — the
figures are web disclosures either way. `'upload'` is unreachable until the
uploaded-report override lands (Later); nothing here pretends otherwise.

### D6 — Model, provider, failure

`generateText` from `ai` with `output: Output.object({ schema })`, model string
`process.env.PIPELINE_MODEL ?? "anthropic/claude-sonnet-5"` — a plain string,
which the AI SDK routes through the AI Gateway using `AI_GATEWAY_API_KEY`
(`library-docs.md`: `provider/model`, dots kept as dots). `@ai-sdk/gateway` is
not imported directly; the default provider is the gateway. No `temperature`
is set: Anthropic's current models reject sampling parameters alongside
thinking, and the structured-output schema is what constrains the answer.
`maxRetries: 0` on the call, because Trigger.dev owns retries (backoff ≥ 60 s,
`pipeline-rules.md` Escalation) and the SDK's built-in retry would stack a
second loop inside the first.

Why Sonnet 5 and not Opus 5: `pipeline-rules.md` Stack names one model for
every pipeline call ("One model, no mixing", Decision log), and that model is
`anthropic/claude-sonnet-5`. The `claude-api` skill's default of Opus 5 is a
generic default; the project contract is the owner here.

New dependency: `ai`. New env: `AI_GATEWAY_API_KEY` in `.env.example`, the
local `.env.local` and the Trigger.dev dev environment. AI calls live in
`lib/extraction/extract.ts` and are invoked only from the task (AGENTS.md:
all AI calls in `trigger/` tasks — the helper is not reachable from any app
surface; it imports `server-only`).

**Failure** mirrors stage 1 exactly: `retry: { maxAttempts: 3, minTimeoutInMs:
60_000 }`; `onFailure` is the only writer of `failed` + `error` + one
`agent_logs` row at `error`; `onCancel` writes the same terminal from
`extracting` only, so a cancellation racing the `completed` write cannot undo
it. A `NoObjectGeneratedError` (the model's output did not match the schema —
including a non-canonical metric) is a thrown error like any other: it spends
an attempt, the model gets a fresh try, and three misses end in `failed`. No
rows are written on any failed attempt, because the write is the last step
and the swap is atomic.

### D7 — Base → ultra escalation is deferred, with the hook left in place

`pipeline-rules.md` Escalation: on a `processor: 'base'` run, zero numeric web
KPIs after extraction → re-run stages 1–2 on ultra. **Not built in T-005.**

- No surface can produce a `base` run. The route never sets `processor`; the
  column defaults to `ultra`; "`processor: 'base'` only by explicit override"
  describes an override that does not exist yet. The path is unreachable.
- The re-run lives in stage 1 (it must flip `processor`, re-trigger itself with
  `reason: "escalation"`, and bound itself to once), and this ticket is
  instructed not to touch stage 1 beyond the handoff.
- "Base-processor escalation paths" is already an entry under Later in
  `tickets.md`.

What T-005 does leave for it: stage 2 returns `{ runId, webKpiCount,
webNumericCount }` to the waiting parent, so the future decision is one `if`
on a value stage 1 already holds, not a new read.

### D8 — Live-stack verification, four seams

Same posture as `t-004-spec.md` D12: no test runner, the real stack
(`npx trigger.dev@latest dev`, `pnpm dev`, service-role SQL).

1. *Row shape.* A fresh run for a known discloser; `select metric, value,
   unit, period, source_url, source_excerpt, confidence, origin from kpis
   where run_id = $1` — every column named in the Check populated on the web
   rows, `value` never null, every metric in `CANONICAL_METRICS`.
2. *Client rows survive a forced retry and win.* A run started with client
   KPIs on metrics the web also discloses (e.g. TRIR, fatalities).
   `FORCE_STAGE2_RETRY=1` makes attempt 1 throw *after* the swap has
   committed, so attempt 2 replays it. Assert: the client rows' `id`,
   `created_at`, `value`, `period`, `confidence`, `origin` identical before and
   after; exactly one row per metric; the client value is the one stored for
   every metric the model also mapped (the drop is visible in the stage-2
   log payload).
3. *Non-canonical metric rejected.* `FORCE_STAGE2_BAD_METRIC=1` injects
   `{ metric: "headcount", finding_index: 0 }` into the model's parsed output
   before the canonical gate in code — the same gate every real output passes.
   Assert: the attempt fails with the metric named in the error, no `kpis` row
   with that metric exists for the run (or any run), and after retries the run
   is `failed` with one `agent_logs` error row. The seam sits after the model
   call deliberately: the model's schema already forbids the value, so the
   only way to exercise the gate is to bypass the schema.
4. *`completed`.* The run from (1): `status = 'completed'`, `completed_at`
   set, `error` null, the stage-2 `agent_logs` rows in order (`extraction
   started` → `kpis extracted` → `run completed`), and the run now appears as
   a cache donor to a subsequent run for the same company.

The two env seams live next to `FORCE_STAGE1_FAILURE` in `.env.example`,
testing-only, never set in a deployed environment.

## Files

New:

- `trigger/kpi-extraction.ts` — the stage-2 task, `onFailure`, `onCancel`
- `lib/extraction/schema.ts` — `WEB_EXTRACTABLE_METRICS`, the Zod schema
- `lib/extraction/extract.ts` — the prompt, the `generateText` call, the
  finding → row projection and the canonical gate
- `supabase/migrations/<ts>_create_replace_extracted_kpis_function.sql`

Changed:

- `trigger/company-research.ts` — the `triggerAndWait` handoff and nothing
  else (D1)
- `lib/runs/agent-log.ts` — three stage-2 messages
- `package.json` — `ai`
- `.env.example` — `AI_GATEWAY_API_KEY`, `FORCE_STAGE2_RETRY`,
  `FORCE_STAGE2_BAD_METRIC`

## Assumptions

- `AI_GATEWAY_API_KEY` will be provisioned by the repo owner before the live
  checks; the code reads it only through the AI SDK's default lookup.
- The AI Gateway exposes `anthropic/claude-sonnet-5` with JSON-schema
  structured output (its docs list it under the Anthropic Messages API
  structured-outputs page).
- One extraction per run is cheap enough that a cache-hit run paying a second
  model call is not worth a cross-run KPI cache — `pipeline-rules.md` says the
  same.

## Open questions

Asked before coding 2026-08-21; answered by the repo owner the same day:
(1) the seven only; (2) `AI_GATEWAY_API_KEY` added to `.env.local` by the
owner before the live checks; (3) the overlap is accepted, stage 2 stays on
its own queue.

1. **Canonical list scope.** `kpi-contract.md` keys three further lagging
   indicators as `Research: web` — `severity_rate`,
   `occupational_illness_rate`, `enforcement_actions` — and says the ledger
   renders web metrics "found or an honest 'not disclosed'". `CANONICAL_METRICS`
   in `lib/runs/metrics.ts` holds only the ask-set seven. Options: (a) extract
   the seven only, matching the code's current list — the three stay unfilled
   until a ticket widens the list; (b) split `metrics.ts` into `ASK_METRICS`
   (route + form, seven) and `WEB_ONLY_METRICS` (three), with
   `CANONICAL_METRICS` their union, and extract all ten. (b) touches the route's
   import. Recommendation: (a) for T-005 — the Check is satisfied either way and
   widening the contract's code list is its own decision.
2. **Gateway credential.** No `AI_GATEWAY_API_KEY` in the repo; live
   verification cannot run without one.
3. **Waiting-parent overlap (D1).** Confirm the brief per-user overlap during
   extraction is acceptable rather than moving stage 2 onto the per-user queue.

## Verification record

All four Check conditions verified 2026-08-21/22 against the live stack, per
D8 — with one deviation: the Gateway key was on Vercel's free tier, which
refuses every Anthropic model ("Free tier users do not have access to this
model"), so the dev worker ran with `PIPELINE_MODEL=openai/gpt-5-mini` (the
contract's own testing override). The production model string in code is
unchanged; the live checks prove the pipeline, not Sonnet 5's judgment.
Every run below was a cache hit on Nestlé (`nestle.ch`) — no Parallel call
was made during T-005.

0. **Failure path, found by accident** — run `1e50358b`, before the model
   override: stage 2 failed three times on the Gateway error with the ≥ 60 s
   backoff, `onFailure` wrote `failed` + `error` + one `agent_logs` error row,
   and the waiting stage 1 logged `extraction failed` (warn, child
   `run_06g2airauiuinnu7sgq381f2c1`) and did **not** retry itself. D1's
   "a child failure is not a parent failure" held.
1. **Row shape** — run `2a456942`, `completed`, 2 web rows: `TRIR 1.13`
   `per million hours worked` 2025 and `fatalities 2` 2025, both citing
   Nestlé's 2025 non-financial statement with a verbatim excerpt, confidence
   `medium`/`high`, `origin: web`; the log names findings 27 and 36 as the
   sources. Attempt 1 stalled from 17:25 to 04:16 the next morning — the
   worker on the dev laptop slept — and attempt 2 finished in 19 s.
2. **Client rows survive a forced retry and win** — run `8e6facc4`, client
   TRIR 0.95 / fatalities 0 / hours_worked 512'000'000, period 2025,
   `FORCE_STAGE2_RETRY=1`. Attempt 1 wrote (`written: 0`, `mapped: []` — the
   prompt excluded the client metrics, so the model had only LTIFR,
   recordables and near misses to fill and found none it trusted), threw,
   attempt 2 replayed the swap, run `completed`. The three client rows' `id`,
   `created_at`, `value`, `period`, `confidence`, `origin` were identical
   before and after. The DB layer (D4, 3) was then exercised directly on the
   same run: `replace_extracted_kpis` with a web `TRIR 1.13` and a web
   `LTIFR 0.42` returned `1` — LTIFR inserted, TRIR refused — the client TRIR
   row kept `0.95` and its id; a swap with `[]` removed the web row and left
   the client rows byte-identical.
3. **Non-canonical metric rejected** — run `268cca06`, `FORCE_STAGE2_BAD_METRIC=1`:
   three attempts (05:26, 05:28, 05:32 — the backoff is visible), each
   stopped at `projectRows` with `non-canonical metric rejected: headcount`
   before the swap; the run ended `failed` with that message in `error`, one
   `agent_logs` error row, 0 `kpis` rows for the run, and
   `select count(*) from kpis where metric = 'headcount'` = 0 across the
   whole table.
4. **`completed`** — runs `2a456942` and `8e6facc4`: `status = completed`,
   `completed_at` set, `error` null, stage-2 log rows in order
   (`extraction started` → `kpis extracted` → `run completed`), and
   `8e6facc4` was the cache donor for the very next run, proving the
   `completed`-only cache index now has stage-2 output behind it.

## Doc updates this work obliges

- `context/product/pipeline-rules.md`, stage 2 — the payload is `{ runId }`;
  `research` and client rows are read from the row; extraction never fills
  `lost_time_injuries`; the model maps findings, code projects the row.
- `context/architecture.md` — Pipeline gains stage 2 and the handoff; Data
  lists the new function.
- `context/library-docs.md` — Vercel AI SDK section gains the `ai`-only
  import rule, `maxRetries: 0`, and the plain-string gateway model.
- `context/tickets.md` — T-005 removed.
- `context/log.md` — one line, `deviated:` for D7.
- `context/ui-registry.md` — no component added; unchanged.
