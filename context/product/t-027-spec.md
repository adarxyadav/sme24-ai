# T-027 spec — Stage 3 retry must not re-buy the peer call

Decided 2026-08-27 before any code. This file records what was decided; it
does not reopen it. The acceptance criteria are the ticket's Check, quoted
verbatim below — nothing here restates or reinterprets it.

## Acceptance criteria

From `context/tickets.md`, T-027, verbatim:

> - What: persist the gathered peers (raw comparison + `parallel_run_id`) before the stage-3 judge call; attempt > 1 of the same run reuses them instead of creating a second Parallel run. From Later (found in T-021).
> - Check: with a seam forcing the judge to fail on attempt 1, attempt 2 completes the run using the persisted peers and `agent_logs` shows exactly one `parallel run created` for stage 3 across both attempts; a normal run is unchanged.

## Standing facts this spec assumes

- The failure class was observed on `1572cc64` (T-021): the judge model call
  runs in the same task attempt as the paid Parallel peer call, so a model
  failure after the result buys a second peer call on retry — the class
  T-005 D1 avoided for stage 1.
- Peer research is never cached across runs (`pipeline-rules.md`, Caching);
  any persistence must be scoped to the one Trigger.dev run's attempts.

## Decisions

### D1 — Trigger.dev run metadata, not a table

The gathered result (`peers`, `references`, `parallel_run_id`,
`industry_notes`) is written with `metadata.set("gathered", …)` followed by
`await metadata.flush()` immediately after the gather (post-escalation),
before the judge. Run metadata is scoped to the Trigger.dev run and shared by
its attempts — exactly the reuse window the contract allows — and dies with
the run, so a re-posted analysis run still buys its own peer call. A
`benchmarks` column would have persisted across re-runs and needed its own
"is this mine" guard; metadata gets that scoping for free and needs no schema
change. The explicit `flush()` matters: the SDK's background flush is
periodic, and the judge call right after is the very failure being guarded.

### D2 — Reuse before gather, logged

On entry, stage 3 reads `metadata.get("gathered")`; when present it skips the
Parallel call entirely and logs `peers reused` (new `LOG_MESSAGES` entry)
with the attempt number and the original `parallel_run_id`. The escalation
check is skipped with the gather — the persisted result is already
post-escalation.

### D3 — Seam

`FORCE_STAGE3_JUDGE_FAIL=1`: attempt 1 throws after the persist, before the
judge — the exact failure point of `1572cc64`.

## Verification record

2026-08-27, dev environment, worker started with `FORCE_STAGE3_JUDGE_FAIL=1`,
run posted via `create_analysis_run` + `tasks.trigger` with service
credentials (Nestlé `nestle.ch` donor, stage 1 cache hit — the only paid call
is stage 3's one base peer call).

Run `6bc7f2bc` (user A):

1. Attempt 1 (04:20:54–04:24:55): `benchmarking started`, one `parallel run
   created` (`trun_d5b71d81…`, base), `peers gathered` (6 peers, 1 reference),
   then the forced throw.
2. Attempt 2 (04:26:32, after the ~97 s backoff): `benchmarking started`
   attempt 2, `peers reused` naming the same `parallel_run_id`, `peers
   gathered` byte-identical counts, judge ran (`benchmark stored`, rank 2 on
   TRIR, calculative) — **no second `parallel run created` for stage 3 across
   both attempts**.
3. The run continued through stages 4–5 and ended `completed`.
4. Normal-path delta is the seam throw alone: attempt 1 gathered, persisted
   and logged exactly as an unseamed run does up to the judge call;
   `npx tsc --noEmit`, `pnpm lint`, `pnpm build` green.

One paid Parallel base call total (stage 1 was a Nestlé cache hit).

## Files

Changed: `trigger/peer-benchmarking.ts`, `lib/runs/agent-log.ts`,
`context/tickets.md`, `context/log.md`, this spec.
