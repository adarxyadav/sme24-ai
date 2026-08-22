# T-021 spec — Base → ultra escalation (stages 1 and 3)

Decided 2026-08-22 before any code. This file records what was decided; it
does not reopen it. The acceptance criteria are the ticket's Check, quoted
verbatim below — nothing here restates or reinterprets it. It delivers
`t-005-spec.md` D7's deferred work and the T-011 constraint on it.

## Acceptance criteria

From `context/tickets.md`, T-021, verbatim:

> - What: `pipeline-rules.md` Escalation, both paths, once only, agent-logged, status never moving. (a) `POST /api/runs` accepts an explicit `processor: "base"` (no form control; default stays ultra) and `create_analysis_run` takes it. (b) Stage 1: on a `base` run whose extraction yields zero numeric web KPIs, flip `processor` to `ultra`, log `escalation`, and `triggerAndWait` itself with `reason: "escalation"`; the re-run writes `trigger_run_id = ctx.run.id` on entry (the T-011 constraint), skips the claim, re-runs research (the tier rule makes it ignore base donors) and the chain from stage 2 on; a re-run never escalates again. (c) Stage 3: when the base peer result carries no numeric TRIR or LTIFR, log `escalation` and repeat the peer call once on ultra. Testing seams `FORCE_STAGE1_ESCALATE` (extraction count reported as zero) and `FORCE_STAGE3_NO_RATES` (base peer rates nulled).
> - Check: (1) migration pushed; `POST /api/runs` with `processor: "base"` creates a `base` row, without it `ultra`, with any other value → 400; (2) a Nestlé `nestle.ch` `base` run under `FORCE_STAGE1_ESCALATE` ends `completed` with: one `escalation` log row (stage `research`, `from: base`, `to: ultra`), `processor = ultra` on the row, a second `company-research` Trigger.dev run with `reason: escalation` whose entry wrote `trigger_run_id` (logged with the handle), no status ever moving backwards (no `queued`/`researching` after `extracting` in the handle/status sequence), the re-run hitting the cache (ultra donor — no Parallel call), and exactly one escalation although the seam reports zero on the re-run too; (3) a Nestlé run under `FORCE_STAGE3_NO_RATES` ends `completed` with one `escalation` row (stage `benchmark`) and two stage-3 `parallel run created` rows, `base` then `ultra` — the one paid ultra peer call this ticket posts — and a `benchmarks` row from the ultra result; (4) a default (ultra) Nestlé run shows no `escalation` row; (5) `npx tsc --noEmit`, `pnpm lint`, `pnpm build` green.

## Standing facts this spec assumes

- Stage 1 already carried `reason: "start" | "escalation"`, exempted an
  escalation from the claim, and read `processor` from the row; no caller
  ever sent `escalation` and no surface could create a `base` row
  (`t-005-spec.md` D7). Stage 2 returns `{ webKpiCount }` to the waiting
  parent.
- `findCachedResearch` applies the tier rule: an ultra run ignores a base
  donor and accepts an ultra one; a base run accepts either.
- Children hand the handle back to the waiting parent (`t-018-spec.md` D4);
  stage 1 is the parent of the whole chain.

## Decisions

### D1 — `processor` is a body field, never a form field

`POST /api/runs` accepts `processor: "base" | "ultra"`, optional, default
ultra; the form never sends it. `create_analysis_run` gains `p_processor`
(dropped and recreated, one signature) so the row's tier lands in the same
write as everything else.

### D2 — Stage 1 escalates by re-triggering itself and handing over the chain

After extraction returns on a `base` run started with `reason: "start"`
and `webKpiCount === 0`, stage 1 flips `processor` to `ultra`, logs
`escalation { from, to, web_kpis }`, and `triggerAndWait`s
`company-research` with `reason: "escalation"`. The re-run:

- writes `trigger_run_id = ctx.run.id` unconditionally on entry and logs
  `escalation re-run entered` with the handle — the row still named the
  first run, which is about to finish, and that is the state the stalled
  sweeper terminates (`t-011-spec.md` D1 said this had to happen; it now
  does). The status is not touched: the machine only moves forward, and the
  row is at `extracting` throughout;
- skips the claim (exempt), re-reads the row (so it sees `ultra`), runs the
  cache lookup under the tier rule — an ultra donor is accepted, a base one
  is not — or Parallel ultra on a miss, reads the upload if any, and then
  chains stages 2–5 exactly as a first run does;
- never escalates again: the rule is gated on `reason === "start"`, so a
  re-run that still finds nothing simply completes with what it has.

The first run returns right after the hand-over (`escalated: true`) and
runs nothing else: the re-run owns the rest of the chain. Cost: the re-run
is one more stage-1 pass (cache hit or one ultra call) plus the chain.

Rejected: re-running research inline in the first run (the "re-run stages
1–2" of the contract would then have two code paths for stage 1); moving
the status back to `researching` (forbidden by the state machine, and the
sweeper would see a new handle on an old status).

### D3 — Stage 3 escalates in place

The peer gathering is a local function of the processor. If the base
result has no peer with a numeric TRIR or LTIFR, stage 3 logs `escalation
{ from, to, peers, base_parallel_run_id }` and gathers once more on ultra;
the ultra result is what is judged and stored, and `parallel run created`
is logged for both calls.

### D4 — Seams

`FORCE_STAGE1_ESCALATE`: the count the rule sees is zero (the real rows
stay). `FORCE_STAGE3_NO_RATES`: the base peer result's rates are nulled
before the rule. Both unset in normal use.

## Verification record

2026-08-22, dev environment, migration
`20260822092605_add_processor_to_create_analysis_run` pushed; worker on
`PIPELINE_MODEL=openai/gpt-5-mini`, restarted per seam. Paid calls, reported
plainly: clause 2 cost nothing (both stage-1 passes hit cache; its stage 3
ran two **base** peer calls — one attempt pair, see the Later note on retry
cost); clause 3 cost one base + one **ultra** peer call on the run that
counts (`cd7a36c2`) and, before it, one base + one ultra peer call on
`44ca6dec`, whose task was cancelled mid-wait when the foreground shell that
had spawned the dev worker timed out ("Dev session ended (CLI exited)") —
the Parallel ultra run completed unused, the stalled sweeper then set the
row `failed` ("ended CANCELED without writing a terminal") exactly as
T-011 specifies. Two ultra calls instead of the one the Check names; my
error, and the reason the worker is now started detached.

1. `POST /api/runs` `processor: "base"` → 201, row `base`; `processor:
   "turbo"` → 400; no field → 201, row `ultra`.
2. `1572cc64` (A, base, `FORCE_STAGE1_ESCALATE`): handle sequence
   `researching run_…0nc1 → extracting child → extracting run_…0nc1 →
   extracting run_…gqc1 (the escalation re-run) → extracting child →
   extracting run_…gqc1 → benchmarking …` — the status never left
   `extracting` during the hand-over; logs: `escalation { from: base, to:
   ultra, web_kpis: 2 }` (one row), `escalation re-run entered {
   trigger_run_id: run_…gqc1, observed_status: extracting, processor:
   ultra }`, second `cache hit` (ultra donor `7900010f`), 0 stage-1
   `parallel run created` rows, `processor = ultra` on the row,
   `completed` 09:42:12. The seam reported zero on the re-run too and no
   second escalation happened.
3. `cd7a36c2` (A, `FORCE_STAGE3_NO_RATES`): `parallel run created
   { processor: base, trun_…d6ee }` 10:05:31 → `escalation { from: base,
   to: ultra, peers: 6, base_parallel_run_id: trun_…d6ee }` 10:10:26 →
   `parallel run created { processor: ultra, trun_…846e }` → `peers
   gathered` 8 peers / 2 references (one dropped: OSHA 200,000-hour base)
   at 10:24:35 → `benchmark stored` rank 2 of 3 comparable on TRIR,
   calculative; `benchmarks.parallel_run_id` = the ultra run; all 8 stored
   peers carry a rate; `completed`. The ultra peer call took 14 min, which
   is why stage 3's `maxDuration`/wait ceilings were raised to stage 1's
   (1800 s / 1500 s) in this ticket.
4. `5e3c3330` (B, default ultra, same seam on): 0 `escalation` rows,
   `completed`.
5. `npx tsc --noEmit`, `pnpm lint`, `pnpm build` green.

## Files

New: migration `add_processor_to_create_analysis_run`, this spec. Changed:
`app/api/runs/route.ts`, `trigger/company-research.ts`,
`trigger/peer-benchmarking.ts` (escalation + ceilings), `lib/runs/agent-log.ts`,
`.env.example`, context docs.
