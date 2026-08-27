# T-012 spec — Stage-1 retry keeps its claim

Decided 2026-08-22 before any code. This file records what was decided; it
does not reopen it. The acceptance criteria are the ticket's Check, quoted
verbatim below — nothing here restates or reinterprets it.

## Acceptance criteria

From `context/tickets.md`, T-012, verbatim:

> - What: the `queued -> researching` claim in `trigger/company-research.ts` also accepts a row already at `researching` whose `trigger_run_id` is the calling Trigger.dev run's own id, so attempt 2+ of the same run re-enters the work instead of logging `run already claimed` and returning with the retry budget spent on nothing (found in T-011). A testing seam `FORCE_STAGE1_RETRY` throws after the claim on attempt 1 (`always`: on every attempt).
> - Check: (1) a Nestlé (`nestle.ch`, cache hit — no Parallel call) run under `FORCE_STAGE1_RETRY=1` ends `completed`, its `trigger_run_id` names the one Trigger.dev run across both attempts, and its `agent_logs` hold no `run already claimed` row; (2) a `reason: start` trigger from a different Trigger.dev run against a row held at `researching` still exits with one `run already claimed` row and writes no `cache hit`/`cache miss` row of its own; (3) a run whose every attempt throws after the claim (`FORCE_STAGE1_RETRY=always`) ends `failed` with `error` set and one `agent_logs` error row from `onFailure`, and no `run already claimed` row; (4) `npx tsc --noEmit`, `pnpm lint`, `pnpm build` green.

## Standing facts this spec assumes

- A Trigger.dev retry is a new *attempt* of the same run: `ctx.run.id` is
  stable across attempts, `ctx.attempt.number` counts them (`t-011-spec.md`,
  Standing facts). The claim writes `trigger_run_id = ctx.run.id`.
- Stage 1's `onFailure` fires only after the last attempt throws. A
  `return` from `run()` — what the lost claim produced — is a `COMPLETED`
  run, so the retry budget was consumed with no terminal written; only the
  T-011 sweeper caught the row (as `COMPLETED` + working status).
- The stalled sweeper's verdict is about the handle it read; at `researching`
  that is the stage-1 run id, which this fix keeps unchanged on a retry.

## Decisions

### D1 — The claim is one conditional update with an `or`

```
update analysis_runs set status = 'researching', trigger_run_id = <ctx.run.id>
 where id = $1
   and (status = 'queued'
        or (status = 'researching' and trigger_run_id = <ctx.run.id>))
```

Still a single statement, so exactly one caller wins from `queued`, and a
retry of the winner wins again because the row already names it. Any other
run — a sweeper re-trigger, a second route enqueue — reads `researching` with
a foreign handle and loses, exactly as before. No status other than
`researching` is accepted: after stage 2's claim the handle is the child's
and the row is the child's to finish.

Rejected: `.in("status", ["queued", "researching"])` alone (re-opens the
T-010 duplicate-Parallel-call hole); a second "was this me?" select before
the update (a window between two statements, the thing the claim exists to
avoid).

### D2 — Seam `FORCE_STAGE1_RETRY`, after the claim

Throws after the claim on attempt 1, or on every attempt when set to
`always`. Sits with the other `FORCE_…` seams in `.env.example`; unset in
normal use. Placed before the hang seam so the two compose if ever needed.

### D3 — Dev-worker env is process env, not `.env.local` re-reads

`trigger.dev dev --env-file .env.local` does not re-read the file (T-011
found this); seams are passed on the command line and the worker restarted
per scenario. `PIPELINE_MODEL=openai/gpt-5-mini` is required on the worker
for stage 2 to finish at all (Gateway free tier, `t-005-spec.md` deviation) —
the first T-012 run, `5b99d817`, proved the stage-1 fix but ended `failed`
in stage 2 because the worker had been started without it.

## Verification record

2026-08-22, dev environment (the only one), worker restarted per scenario,
runs posted through `POST /api/runs` with a minted session for user A. All
three runs were Nestlé `nestle.ch` cache hits — no Parallel call was made.

1. **Retry re-wins its claim → `completed`.** `c5b57238` under
   `FORCE_STAGE1_RETRY=1`: Trigger.dev run `run_06g2gotldjg892ikbfs6rv2sc1`
   attempts `.1` (threw after the claim, 13:03:38 local) and `.2`
   (`client kpis read` 07:35:20 UTC, `cache hit` donor `879ae160`,
   `research stored`); stage 2 child `run_06g2gpaf2r7k0fvclv31hnkoc1`
   extracted TRIR + fatalities on gpt-5-mini; `completed` 07:35:38,
   `error` null. Zero `run already claimed` rows. (`5b99d817`, the first
   attempt at this clause, showed the same stage-1 behaviour — attempts
   `.1`/`.2`, no claim loss — and failed only in stage 2 on the Gateway
   error, D3.)
2. **Foreign `start` trigger still loses.** `32511048` held at
   `researching` by `FORCE_STAGE1_HANG` with handle
   `run_06g2gr19nn5dt7u3cbqbikdfc1`; `tasks.trigger("company-research",
   { runId, reason: "start" })` from a scratch script ran as
   `run_06g2gr62jkbkec8qf119qorpc1` → `COMPLETED` with
   `{ skipped: true }`; the row gained exactly one `run already claimed`
   row (07:43:32, `observed_status: researching`) and no `cache hit`/`cache
   miss` from it; status and handle unchanged. The run was then cancelled
   (`onCancel` → `failed`, "Run cancelled before stage 1 completed"); the
   `cache hit`/`research stored` rows at 07:43:38 are the hung run's own
   continuation after the seam's sleep resolved on abort — the seam artefact
   already noted in `t-011-spec.md`, not the duplicate trigger.
3. **Every attempt throws → `failed` via `onFailure`.** `c0d681c2` under
   `FORCE_STAGE1_RETRY=always`: attempts `.1`/`.2`/`.3` of
   `run_06g2gpht6jq5mdmiuirkdjnfc1` (13:06 → 13:12 local, backoff visible),
   `failed` at 07:42:06 UTC, `error` = "Error: Forced stage 1 retry
   (FORCE_STAGE1_RETRY, attempt 3)", exactly one `agent_logs` error row
   (`stage failed`), no `run already claimed` row, `trigger_run_id` still
   the stage-1 run.
4. `npx tsc --noEmit`, `pnpm lint`, `pnpm build` — green.

## Files

Changed: `trigger/company-research.ts` (claim predicate, seam),
`.env.example`, `context/architecture.md` (Pipeline), 
`context/product/pipeline-rules.md` (state machine), `context/tickets.md`,
`context/log.md`. New: this spec.
