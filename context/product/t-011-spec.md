# T-011 spec — Stalled in-progress runs

Decisions settled 2026-08-22 before any code. This file records what was
decided; it does not reopen it. The acceptance criteria are the ticket's Check,
quoted verbatim below — nothing here restates or reinterprets it.

## Acceptance criteria

From `context/tickets.md`, T-011, verbatim:

> - What: give `researching` and every later working status an owner, the way T-010
>   gave `queued` one — a scheduled sweeper that asks Trigger.dev whether the task
>   behind an in-progress run is still alive (`runs.retrieve`), and sets the run
>   `failed` through the existing terminal shape (status + error + agent_logs row)
>   when it is not. No age threshold; a run may legitimately hold `researching` for
>   the task's full 30-minute maxDuration.
> - Check: a run whose task is dead (cancelled in the Trigger.dev dashboard, or a
>   worker killed mid-attempt) ends `failed` with an `error` and one `agent_logs`
>   error row within one sweep; a run whose task is alive — including one waiting
>   inside `triggerAndWait` — is untouched after 3 sweeps; a run in a terminal
>   status is never touched; the dashboard's in-progress state shows nothing of the
>   sweep; `1d3d2bed` (stalled at `researching` since 2026-08-22 05:52) is
>   resolved by the deployed sweeper, not by hand.

## Standing facts this spec assumes

Verified against the code, the migrations, the installed SDK (4.5.12) and the
EU project on 2026-08-22, not recalled.

- `public.run_status` has nine values; the working (non-terminal, post-queue)
  ones are `researching`, `extracting`, `benchmarking`, `matching`,
  `generating`. Terminals: `completed`, `failed`, `no_data`. `queued` is owned
  by `trigger/sweep-queued-runs.ts` (T-010).
- **No Trigger.dev run handle is stored anywhere today.** `app/api/runs/route.ts`
  discards the return of `tasks.trigger` (the `await` has no binding); the
  queued sweeper does the same. `agent_logs` payloads carry a Trigger.dev run
  id in exactly one place — `child_run_id` on the `extraction failed` warn row
  stage 1 writes when `triggerAndWait` returns `ok: false`. A query for any
  payload containing `run_` over the live table returns nothing. `1d3d2bed`'s
  rows are `client kpis read` and `cache miss` (05:54:13) and nothing after.
- Stage 1 claims with `update({ status: "researching" }).eq("status", "queued")`
  for `reason: "start"`; stage 2 claims with `update({ status: "extracting" })
  .in("status", ["researching", "extracting"])`. Both are single conditional
  updates — the place a handle can be written atomically with the status.
  Inside `run()`, `ctx.run.id` is the task's own Trigger.dev run id; a retry is
  a new attempt of the same run and keeps the id.
- Terminal writers and their guards: stage 1 `onFailure` writes `failed`
  unguarded; stage 1 `onCancel` writes `failed` from `queued`/`researching`;
  stage 2 `onFailure` unguarded; stage 2 `onCancel` from `extracting`; stage 2
  writes `completed` from `extracting`; stage 1 writes `no_data` unguarded
  after research. SDK docs (`tasks/overview.mdx`): `onFailure` does not fire
  for cancelled, crashed or system-failed runs; `onCancel` fires only for
  cancellation. So a crash (`CRASHED`, `SYSTEM_FAILURE`, `TIMED_OUT` after
  retries) at `researching`/`extracting` leaves the row as it is — the gap this
  ticket closes.
- A child failure is not a parent failure (`t-005-spec.md` D1): if stage 2's
  run dies, the parent logs `extraction failed` and returns `COMPLETED`. The
  row stays `extracting` unless stage 2's own hook wrote `failed`, which a
  crash never does.
- `RunStatus` in `@trigger.dev/core` 4.5.12 is exactly: `PENDING_VERSION`,
  `QUEUED`, `DEQUEUED`, `EXECUTING`, `WAITING`, `COMPLETED`, `CANCELED`,
  `FAILED`, `CRASHED`, `SYSTEM_FAILURE`, `DELAYED`, `EXPIRED`, `TIMED_OUT`.
  The SDK's own groupings (`runStream.js`): queued = `PENDING_VERSION`,
  `QUEUED`, `DELAYED`; waiting = `WAITING`; executing = `DEQUEUED`,
  `EXECUTING`; failed = `FAILED`, `CRASHED`, `SYSTEM_FAILURE`, `EXPIRED`,
  `TIMED_OUT`; success = `COMPLETED`; cancelled = `CANCELED`. `WAITING` is
  the status of a parent inside `triggerAndWait`; a retry backoff reports as
  `EXECUTING` (`RETRYING_AFTER_FAILURE` maps to it). `runs.retrieve` returns
  `{ id, status, taskIdentifier, finishedAt?, error? … }` and throws `ApiError`
  with `.status` (404 for an id the environment does not know).
- `runs.retrieve` inside a task uses the worker's own `TRIGGER_SECRET_KEY`,
  which is per-environment: a run id from the dev environment is a 404 to the
  production key and vice versa. There is no production deployment yet
  (README Deploy: "Not set up yet"); every run to date was executed by
  `trigger.dev dev`, and scheduled tasks run in dev while the CLI is connected.
- API rate limit: 1,500 requests/minute (`limits.mdx`). The queued sweeper
  runs `*/5 * * * *` UTC with a 100-row page.
- Read layer: `lib/portal/runs.ts` selects `id, company_name, company_domain,
  status, created_at`; `lib/portal/run-state.ts` maps `failed` → "Delayed" and
  every working status → "In progress". Neither selects `error` or anything a
  new column would add.
- Found while verifying, outside this Check: stage 1's claim is conditional
  on `queued` alone, so attempt 2 of a stage-1 run that threw *after* the
  claim (a Parallel error, a write failure) loses the claim, logs `run already
  claimed`, and returns — the retry is a no-op and `onFailure` never fires.
  Recorded under Later; this sweeper sees that run as `COMPLETED` with a
  working status and terminates it, so the row no longer stalls, but the retry
  itself is still lost.

## Decisions

### D1 — The handle is a column, written inside the claim

`analysis_runs.trigger_run_id text` (nullable), written by the same conditional
update that moves the status: stage 1 sets it with `researching`, stage 2
overwrites it with `extracting`. It always names **the Trigger.dev run
currently responsible for moving the row** — one id, not a history.

- Survives a retry: a retry is a new attempt of the same run, same id.
- Survives the stage-2 handoff: the child overwrites the parent's id the moment
  it claims, so at `extracting` the handle is the child's (D3).
- Survives an escalation re-run by construction, when one lands: the
  escalation entry point is exempt from the claim today (`reason:
  "escalation"`) and therefore **must write `trigger_run_id = ctx.run.id`
  unconditionally on entry** — otherwise the row would still point at the
  finished first run and the sweeper would terminate the escalation. This is a
  constraint on `t-005-spec.md` D7's deferred work, noted there by reference
  under Later; no escalation path exists in the code yet.

Rejected: reading `agent_logs` payloads (no row carries the stage-1 id, and
adding one means a second write that can race the claim — a handle written
after the status leaves a window where the row is working with no handle);
`runs.list` filtered by tag (needs every trigger site — route, queued sweeper,
stage 1's `triggerAndWait` — to tag consistently, costs a list call per run,
and the list items do not carry the payload, so matching still needs a
`retrieve` each; and no existing run is tagged, so it cannot resolve
`1d3d2bed`).

### D2 — Liveness: every SDK status mapped, unknown leaves the run alone

`Record<RunStatus, "alive" | "dead">`, exhaustive so a new enum value in a
future SDK fails the build rather than being silently mis-filed:

| Trigger.dev status | Verdict | Why |
|---|---|---|
| `PENDING_VERSION` | alive | waiting for a deploy to carry the task; the run will execute |
| `QUEUED` | alive | re-queued after a retry backoff, or not yet dequeued |
| `DELAYED` | alive | scheduled to start; nothing writes a delay today, but it is a future |
| `DEQUEUED` | alive | on its way to a worker |
| `EXECUTING` | alive | working, or in retry backoff (`RETRYING_AFTER_FAILURE`) |
| `WAITING` | alive | parent inside `triggerAndWait`; the child is the one doing work (D3) |
| `COMPLETED` | dead | the task returned and the row is still working → its terminal write was lost (a stage-1 run whose retry was neutered, a failed `completed` write) |
| `CANCELED` | dead | `onCancel` should have written `failed`; if it did, the row is terminal and never selected |
| `FAILED` | dead | `onFailure` should have written `failed`; same |
| `CRASHED` | dead | no hook fires (SDK docs) |
| `SYSTEM_FAILURE` | dead | no hook fires |
| `TIMED_OUT` | dead | `maxDuration`; retried first, this is the final state |
| `EXPIRED` | dead | TTL passed before start; cannot happen to a claimed run, mapped for completeness |

A status outside the table (only possible with an SDK upgrade that widens the
enum without a type error, i.e. a runtime string the build did not see) is
**unknown**: one `agent_logs` warn row, no write. A `runs.retrieve` that throws
is also unknown — *including 404*, because 404 is what a run id from another
Trigger.dev environment looks like (same database, different secret key), and
failing a run on "my key cannot see it" would let a production sweeper kill
runs a dev worker is executing. Never fail a run on uncertainty.

A row in a working status with `trigger_run_id IS NULL` is **dead by
construction**: every path into a working status writes the handle in the same
statement, so a null handle means no task of this version ever claimed it.
That is exactly `1d3d2bed`'s state after the migration, and it is how the Check's
last clause is met by the sweeper rather than by hand. Logged with
`reason: "no_handle"` so it is distinguishable from a dead task in the rows.

Rejected: `isCompleted`/`isFailed` booleans from the response (they hide
`CANCELED` inside neither and would need the same table to be explicit); an age
threshold as a second signal (the ticket forbids one, and the row cannot know a
task's remaining `maxDuration`).

### D3 — At `extracting` the child decides

The row holds one handle and at `extracting` it is stage 2's (D1). The parent's
`WAITING` status says nothing about whether the row will ever leave
`extracting`: if the child dies, the parent wakes, logs a warning, and
completes normally — it never writes a terminal. If the parent is cancelled,
Trigger.dev cancels its children too, so the child reads `CANCELED`. There is
no case where the child is alive and the row is stalled, and no case where the
parent's status is needed to detect a stall.

Rejected: two columns (parent + child) with "both must be alive" (the parent's
status is never decisive, and a second column is a second thing to keep
consistent).

### D4 — The write is conditional on status *and* handle

```
update analysis_runs
set status = 'failed', error = …, completed_at = now()
where id = $1
  and status in ('researching','extracting','benchmarking','matching','generating')
  and trigger_run_id is not distinct from $2   -- the handle the verdict was about
```

Status guard: `onFailure`/`onCancel` or stage 2's `completed` may land between
the select and this write; a terminal row is never overwritten — same idiom as
the claim and as T-010's terminate. Handle guard: stage 2 may claim
(overwriting the handle) between the parent's `retrieve` and this write; then
the verdict was about a run that no longer owns the row, and the update must
miss. Zero rows updated → nothing logged, the next sweep re-evaluates. The
`agent_logs` row is written only after the update reports a row changed, so
"one error row" holds.

`error` text: `Run's task ended <STATUS> without writing a terminal` /
`Run has no task handle` — internal-facing, never read by the dashboard.

### D5 — Cadence and cost: `*/5`, one `retrieve` per working run, page of 100

Its own task, `trigger/sweep-stalled-runs.ts`, id `sweep-stalled-runs`, cron
`*/5 * * * *` UTC, a sibling of the queued sweeper rather than a branch inside
it: the two select different rows, take different actions, and the queued one
is verified and untouched (surgical). Each sweep selects working-status rows
ordered by `created_at` with `limit 100` and issues one `runs.retrieve` per
row — at most 100 API calls per five minutes against a 1,500/minute limit. A
backlog above 100 drains over subsequent sweeps; a healthy system has a handful
of rows. Per-row errors `continue`, as in the queued sweeper — one run never
abandons the batch.

Worst-case detection latency is one interval plus the retrieve: the Check says
"within one sweep", which holds for any interval. Five minutes matches the
queued sweeper and is short against the 30-minute `maxDuration` the ticket
cites as the legitimate ceiling.

Partial index `analysis_runs_working_idx on (created_at) where status in
(…working…)`, the T-010 idiom, in the same migration as the column.

Rejected: folding into `sweep-queued-runs` (would re-open a verified task and
mix two contracts in one loop); `runs.list` by status as a batch call (returns
Trigger.dev's view, not ours — we need the row-by-row verdict).

### D6 — `cancelled` stays `failed`; no enum change

`onCancel` writes `failed` (t-004-spec.md, stage 1 task comment); the sweeper
writes the same. A distinct `cancelled` status is a schema change and is
already its own Later note ("Cancelled-run terminal status"); nothing in this
Check needs it, and the dashboard's "Delayed" is the honest copy for a run
whose task died for any reason.

### D7 — The dashboard is untouched

`failed` already renders "Delayed" with no internals (`t-006-spec.md` D3), and
the working statuses already render "In progress". The read layer's column
list does not include `trigger_run_id` or `error`, so nothing of the sweep can
reach a page. No read-layer change; the Check's dashboard clause is verified by
`curl` + `grep` on the failed run's page.

### D8 — Test seams

Two `.env.example` seams in the `FORCE_…` family, unset in normal use:

- `FORCE_STAGE1_HANG`: stage 1 sleeps ten minutes after its claim (plain
  `setTimeout`, so the run stays `EXECUTING`, not `WAITING`). A Nestlé run is a
  cache hit that completes in ~25 s otherwise — too fast to cancel or kill
  deliberately.
- `FORCE_STAGE2_HANG`: stage 2 sleeps ten minutes after its claim, which holds
  the parent inside `triggerAndWait` (`WAITING`) with the child `EXECUTING` —
  the Check's "alive, including one waiting inside `triggerAndWait`" case.

Both sleep via the task's `signal` so a cancellation ends the sleep at once.

### D9 — Live verification, one item per Check clause

Against the dev environment (the only one that exists; see Standing facts —
"deployed sweeper" is read as the cron task registered with the running dev
worker, and the log line says so). Manual sweeps are triggered with
`tasks.trigger("sweep-stalled-runs", <schedule payload>)` from a scratch script.

1. *Dead task → failed.* Nestlé run with `FORCE_STAGE1_HANG`; cancel in the
   dashboard → `onCancel` writes `failed` itself (the existing path — the
   sweeper must find nothing to do). Then a second Nestlé run, hang, and
   **kill the dev worker** (SIGKILL) mid-attempt; restart the worker; Trigger.dev
   reports the run `CRASHED` or `SYSTEM_FAILURE`; one sweep → `failed`, `error`
   set, exactly one `agent_logs` error row for the run.
2. *Alive untouched.* Nestlé run with `FORCE_STAGE2_HANG`; parent `WAITING`,
   child `EXECUTING`; three manual sweeps; row unchanged (status, handle,
   `completed_at`), no new `agent_logs` rows. Also a run at `researching`
   under `FORCE_STAGE1_HANG` across sweeps.
3. *Terminal untouched.* Snapshot every `completed`/`no_data`/`failed` row
   (full row JSON) before the sweeps in 1–2 and diff after: byte-identical.
4. *Dashboard.* `curl` the killed run's page with the owner's cookie; grep for
   `sweep`, `trigger`, `CRASHED`, `handle`, `terminal` — zero; "Delayed"
   present.
5. *`1d3d2bed`.* After `db push`, its `trigger_run_id` is null; the next cron
   sweep (not a manual one) sets it `failed` with `reason: "no_handle"`.

Then `npx tsc --noEmit`, `pnpm lint`, `pnpm build`.

## Files

New: `trigger/sweep-stalled-runs.ts`; migration
`add_trigger_run_id_for_stalled_sweep`; this spec.

Changed: `trigger/company-research.ts` (handle in the claim, `ctx`, hang
seam), `trigger/kpi-extraction.ts` (handle in the claim, hang seam),
`lib/runs/agent-log.ts` (two messages), `.env.example`, `context/architecture.md`
(Pipeline + Data), `context/product/pipeline-rules.md` (state machine),
`context/tickets.md`, `context/log.md`.

## Assumptions

- The dev worker is the deployment. If a production environment is created
  later, the sweeper there sees dev-executed runs as 404 → unknown (D2) and
  leaves them to the dev sweeper; a `trigger_run_id` prefixed by environment
  is not needed for that, the key boundary already does it.
- Killing `trigger.dev dev` mid-attempt produces a final state Trigger.dev
  reports as dead within a few minutes. If the platform instead retries the
  attempt on the restarted worker, that is "alive" and correct — the kill is
  then repeated with the worker left down until the run is final.

## Verification record

All clauses exercised 2026-08-22 against the live stack: `pnpm dev` on the EU
project, `trigger.dev dev` as the only Trigger.dev environment, runs created
through `POST /api/runs` with sessions minted for the two test users, sweeps
triggered both by the `*/5` cron and by hand (`tasks.trigger` on
`sweep-stalled-runs` with a schedule payload). Migration
`20260822064803_add_trigger_run_id_for_stalled_sweep` pushed first.

1. **Dead task → failed, within one sweep.** `f6b4d774` (Nestlé, user A)
   claimed at 06:54:08 with handle `run_06g2gfsh21…`; its attempt process was
   SIGKILLed at 06:56:17 and Trigger.dev reported `CRASHED` within two seconds
   while the row stayed `researching` (the gap). Manual sweep
   `run_06g2ggp9as…` at 06:58:04 → `{checked: 2, terminated: 1}`; row now
   `failed`, `error` = "Run's task ended CRASHED without writing a terminal",
   `completed_at` 06:58:08, exactly one `agent_logs` error row (`stalled run
   swept`, `reason: task_dead`, `trigger_status: CRASHED`). Dashboard-cancel
   path: `183e5e3a` and `daf9af97` cancelled via `runs.cancel` → the existing
   `onCancel` wrote `failed` ("Run cancelled before stage 1 completed") before
   any sweep ran, so the sweeper never selected them — the platform-cancelled
   case where `onCancel` has no worker (what happened to `1d3d2bed`'s original
   run, `TASK_RUN_STALLED_EXECUTING`) maps to `CANCELED` → dead in D2.
2. **Alive untouched after 3 sweeps.** `183e5e3a` (`EXECUTING`, inside the
   Parallel wait) survived sweeps `run_06g2ggp9as…`, `…gqeq3…`, `…grbds…`
   unchanged. `623075bf` (Nestlé `nestle.ch`, cache hit, user A) reached
   `extracting` at 07:01:42 with the handle overwritten by the child
   (`run_06g2ghielh…`, `kpi-extraction`, held by `FORCE_STAGE2_HANG`) while the
   parent `run_06g2ghhs8…` sat in `triggerAndWait`; three sweeps
   (`run_06g2ghrpj…`, `…ghsl6…`, `…ghtgu…`) each returned
   `{checked: 1, terminated: 0}`; status, handle, `completed_at` and the
   `agent_logs` rows unchanged. Note: in the dev environment the waiting parent
   reports `EXECUTING`, not `WAITING` (no checkpointing in dev); both map to
   alive.
3. **Terminal rows never touched.** Full-row JSON of every
   `completed`/`no_data`/`failed` row and their `agent_logs` (11 runs, 61 rows)
   snapshotted before the first sweep and diffed after the last: 11/11
   identical, 0 log rows missing or added.
4. **Dashboard shows nothing of the sweep.** `curl` of
   `/dashboard/runs/f6b4d774…` with user A's cookie → 200, "Delayed" present
   (4 hits), zero hits for `sweep`, `trigger`, `CRASHED`, `handle`,
   `terminal`, `without writing`.
5. **No-handle branch (the path `1d3d2bed` would have taken).** `623075bf`'s
   `trigger_run_id` set to null as a fixture while its child was alive; manual
   sweep `run_06g2gi0lh…` → `failed`, `error` = "Run has no task handle", one
   error row with `reason: no_handle`. The parent was then cancelled: the
   child's `onCancel` (guarded on `extracting`) did not overwrite the
   sweeper's terminal — the race guard in D4 holding in the other direction.
6. **`1d3d2bed` — not resolved by the sweeper, and why.** At 06:46:22, before
   this branch's sweeper existed in the worker, another session requeued the
   run by hand (`manually requeued` row: "worker handover cancelled
   run_06g2g1lq… (TASK_RUN_STALLED_EXECUTING); onCancel had no worker to run
   on"); the queued sweeper re-triggered it at 06:50:41, stage 1 re-claimed it
   at 06:52:31 under the new code (handle `run_06g2gf327…`), and it ran a real
   Glencore ultra call to `completed` at 06:56:10. The first cron tick of the
   new sweeper (`run_06g2gg1v9q…`, 06:55:00) found it alive and left it —
   correct. The mechanism that would have resolved it as left at 05:52
   (working row, no handle → `failed`) is item 5.

Cost incurred by the verification, reported plainly: the first three Nestlé
runs (`f6b4d774`, `183e5e3a`, `daf9af97`) were posted with `companyDomain:
nestle.com`, but every cache donor is keyed `nestle.ch`, so each was a cache
miss that created a paid Parallel **ultra** run before being killed or
cancelled. Two errors of mine: the wrong domain, and assuming `trigger.dev
dev` re-reads `.env.local` for the hang seam (it does not; the seam only took
effect after a worker restart, which also explains why those three "hung" —
they were inside the real Parallel wait). The `parallel run created` log row
is written only after the wait returns, so the rows show `cache miss` and
nothing else; that is now a Later note.

Also found: the `623075bf` child logged `extraction started` after its
cancellation, because the seam's sleep resolves on abort and the next line runs
before teardown — seam behaviour only, not shipped code.

Then `npx tsc --noEmit`, `pnpm lint`, `pnpm build` — all green.
