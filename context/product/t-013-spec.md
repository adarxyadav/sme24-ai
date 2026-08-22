# T-013 spec — Log the Parallel run id before the wait

Decided 2026-08-22 before any code. This file records what was decided; it
does not reopen it. The acceptance criteria are the ticket's Check, quoted
verbatim below — nothing here restates or reinterprets it.

## Acceptance criteria

From `context/tickets.md`, T-013, verbatim:

> - What: stage 1 writes its `parallel run created` `agent_logs` row the moment Parallel's create call returns — before the blocking result loop — so a run that dies mid-wait still names the paid Parallel run (T-011 found the row only lands after the wait, leaving `cache miss` and nothing else).
> - Check: one cache-miss run (Geberit AG, `geberit.com` — the one paid ultra call this ticket posts, chosen so the result becomes a real cache donor) has its `parallel run created` row, carrying `parallel_run_id` and `processor`, observable by a service-role read while the run is still `researching` with `research` null, and its `created_at` precedes `research stored`; the run ends `completed`; `npx tsc --noEmit`, `pnpm lint`, `pnpm build` green.

## Standing facts this spec assumes

- `researchCompany` (`lib/parallel/client.ts`) is `createRun` then
  `fetchResult`; the task logged `parallel run created` only after it
  returned (`t-011-spec.md`, Verification record — three killed runs showed
  `cache miss` and nothing else while a paid run existed).
- `agent_logs` is service-role only; the Check's "observable by a
  service-role read" is a scratch query, never the UI.
- No Geberit run exists in `analysis_runs`, so the run is a miss by
  construction (`reason: none`).

## Decisions

### D1 — A callback on `researchCompany`, not a split API

`researchCompany` gains `onRunCreated?: (parallelRunId) => Promise<void>`,
awaited between `createRun` and `fetchResult`. The task passes the
`agentLog` call. The client module keeps one entry point and the task keeps
one call; the log row's shape (`parallel_run_id`, `processor`) is unchanged,
only its moment moves.

Rejected: exporting `createRun`/`awaitResult` separately and sequencing them
in the task (two calls to keep in order at every future caller — stage 3's
peer call is next); logging inside the client (`lib/parallel/` would then
import the service client and `agentLog`, crossing into orchestration).

### D2 — One paid run, and it earns its keep

The Check cannot be met on a cache hit: the row under test only exists on a
miss. One ultra run is posted, for a Swiss discloser not yet in the table, so
the result is a 30-day cache donor rather than a cancelled waste. Nothing is
killed mid-wait — the ordering is proven by the service-role observation
during the wait and by `created_at` on the rows, which is the same evidence a
killed run would leave.

## Verification record

2026-08-22, dev environment, worker `20260822.8` (hot-reloaded after the
change), run posted through `POST /api/runs` with a minted session for user
A. **One paid Parallel ultra call** — `trun_68d2b2d6efcf428e961fb2c238a0e6b3`.

- Run `d7fd0dc7` (Geberit AG, `geberit.com`). Rows in order: `client kpis
  read` 07:46:45.410, `cache miss` 07:46:45.877 (`reason: none`), **`parallel
  run created` 07:46:46.542** with `parallel_run_id` and `processor: ultra`.
  A service-role poll at 07:46:47 read the run as `researching` with
  `research` null while that row already existed — the wait had barely
  begun.
  `research stored` followed at 07:58:11 (48 findings, `sector` 23.42,
  `source: parallel`) — 11 min 25 s after the create row, the window in
  which a killed run would previously have shown nothing. Stage 2 extracted
  three web KPIs (LTIFR among them, on gpt-5-mini); `completed` 07:58:31,
  `error` null. Geberit is now a `geberit.com` cache donor.
- `npx tsc --noEmit`, `pnpm lint`, `pnpm build` — green.

## Files

Changed: `lib/parallel/client.ts` (`onRunCreated`), `trigger/company-research.ts`
(log moved into the callback), `context/architecture.md` (Pipeline),
`context/library-docs.md` (Parallel), `context/tickets.md`, `context/log.md`.
New: this spec.
