# T-016 spec — Stage 3 peer benchmarking

Decided 2026-08-22 before any code. This file records what was decided; it
does not reopen it. The acceptance criteria are the ticket's Check, quoted
verbatim below — nothing here restates or reinterprets it.

## Acceptance criteria

From `context/tickets.md`, T-016, verbatim:

> - What: `trigger/peer-benchmarking.ts`, chained from stage 1 via `triggerAndWait` after extraction, moving `extracting -> benchmarking -> completed` (stage 2 no longer writes `completed`). Parallel (base processor, never cached) gathers same-sector peers — each with `trir` AND `ltifr`, reporting year, scope, `source_url` — plus industry references; one Claude call (`Output.object`) emits the judgment: `rate_metric`, the comparable peer subset, Hudson maturity label + rationale, verdict. Code derives `rank`/`peer_count` (rank 1 = lowest rate) and keeps references only on `rate_metric`'s metric + base; the read layer re-derives rank from the stored peer list. `benchmarks` table (owner-select RLS, service-role writes). `BenchmarkCard` on the completed run page; "Emerging" rendered for Pathological; insufficient data stated when neither peers nor references exist, run still `completed`. Contract: `pipeline-rules.md` Stage 3 + comparability rules.
> - Check: (1) a Nestlé `nestle.ch` cache-hit run ends `completed` with `agent_logs` showing `extracting -> benchmarking` claimed, a stage-3 `parallel run created` row with `processor: base`, and a `benchmarks` row whose every peer carries `trir`, `ltifr`, `reporting_year`, `scope`, `source_url`, whose `rate_metric` is `TRIR` or `LTIFR`, whose `references` (when present) match `rate_metric`'s metric and base, and whose stored `rank`/`peer_count` equal the read layer's re-derivation from the same peers; (2) a second Nestlé run makes a second stage-3 Parallel call (two distinct peer `parallel_run_id`s, no stage-3 cache row) — stage 1 still hits cache; (3) with `FORCE_STAGE3_EMPTY` (no peers, no references, no Parallel call, no model call) the run ends `completed` and its page states insufficient benchmark data; (4) the completed page shows rank as "n of N", the maturity label, verdict and the peer table with source links, and a `benchmarks` row set to `pathological` renders "Emerging"; (5) user B selecting run A's `benchmarks` row through the session client gets 0 rows; `anon` holds no privilege on the table; (6) migration pushed via `supabase migration new` + `db push`; `npx tsc --noEmit`, `pnpm lint`, `pnpm build` green.

## Standing facts this spec assumes

- Stage 2 wrote `extracting -> completed` (`t-005-spec.md` D1) and returned
  `{ webKpiCount }` to the waiting stage 1; stage 1 logs a child failure and
  never rethrows. Stage 1's `research.output` carries `sector` (NACE) and
  `company` (country, headcount) — stage 3's inputs.
- `lib/parallel/client.ts` was specific to the EHS schema; its create/result
  loop is the same for any schema.
- The read-layer boundary allows `lib/portal/` to import only the session
  client and `lib/runs/metrics`.
- Stored rate units are free text as disclosed ("per million hours worked",
  "per 1 million hours worked", …).

## Decisions

### D1 — Stage 3 owns `completed`; stage 2 stops at `extracting`

Stage 1 chains stage 3 with `triggerAndWait` right after a successful stage
2, same shape as the stage-2 handoff (child hooks write the terminal, a
child failure is logged, never rethrown). Stage 3 claims
`extracting|benchmarking -> benchmarking` writing `trigger_run_id` (the
T-011 handle), and finishes `benchmarking -> completed`. Stage 2's
completion write and its `run completed` log are removed — the log message
moves to stage 3. Stages 4–5 will repeat the pattern and take `completed`
over in turn.

### D2 — Parallel gathers, the model judges, code counts

`lib/parallel/client.ts` gains one generic create/result pair (schema and Zod
parser as parameters) and a second entry point `benchmarkPeers` —
`researchCompany` is unchanged for callers. The peer schema
(`lib/parallel/peer-schema.ts`) asks for 5–10 same-NACE peers (Switzerland/
Europe preferred, the company itself excluded), each with TRIR and LTIFR as
disclosed plus basis, year, scope, source, and sector references (median,
best-in-class) with the SUVA-style per-1'000-FTE exclusion written into the
description. Processor `base` (pipeline-rules.md, Escalation: "Benchmark peer
call — base by default"); never cached. Parallel receives the public company
name, sector and headcount — never the company's KPIs.

`lib/benchmark/judge.ts` makes the one model call (`Output.object`,
`benchmarkJudgmentSchema`): `rate_metric`, `comparable_peer_indices`, Hudson
`maturity_label`, `maturity_rationale`, `verdict`. The prompt forbids stating
a rank or percentile and forbids numbers not in the input. Skipped entirely
when there are neither peers nor on-base references.

`lib/runs/rank.ts` (pure, shared) holds the arithmetic: `isPerMillionHours`
recognises the base in free text; `comparablePeerRates` keeps judged-comparable
peers that carry a figure for `rate_metric` on that base; `deriveRank` gives
`rank = 1 + peers below the company's rate` and `peerCount`. The engine stores
the result and the read layer re-derives it from the same stored peers — one
function, two call sites. The ESLint boundary gains `!@/lib/runs/rank` for
this reason (it is contract arithmetic, like `metrics`).

References: only those on the per-million base reach the judge at all (a
rationale must not cite a figure the card cannot show — found on the first
live run, where the model quoted a sector median the card had dropped), and
the stored `references` is the first on `rate_metric`'s metric. Dropped ones
are listed in the `peers gathered` log row.

### D3 — `benchmarks` table, one row per run

`run_id` unique FK (cascade), `rate_metric` (`TRIR`|`LTIFR`|null),
`peer_count`, `rank`, `verdict`, `maturity_label` (new enum, nullable),
`maturity_rationale`, `per_metric_comparison` jsonb (`schema_version`,
`rate_metric`, `company` rates, `peers[]` with `comparable`, `references`,
`industry`), `parallel_run_id`. Same privilege idiom as `kpis`: `revoke all`
from `public, anon, authenticated`, `select` back to `authenticated` under an
owner-through-run policy, CRUD to `service_role`. Stage 3 upserts on `run_id`
so a retry replaces rather than duplicates.

### D4 — `BenchmarkCard`

Title "Rank n of N on TRIR" (N = comparable peers + the company), "No
comparable peer rate" when the judge found no shared base, "Insufficient
benchmark data" when there is nothing at all; maturity as an outline Badge
(`MATURITY_DISPLAY` renders `pathological` as "Emerging"); verdict and
rationale; references as a `dl`; peer table with each peer's own basis shown
and non-comparable peers marked "not ranked". Runs completed before stage 3
existed have no row and no card.

### D5 — Seam `FORCE_STAGE3_EMPTY`

Skips Parallel and the model, stores an empty comparison. Proves the
insufficient-data path for free; the real path is proven by the two paid
base runs the Check names.

## Verification record

2026-08-22, dev environment, migration `20260822080738_create_benchmarks_table`
pushed first; worker `PIPELINE_MODEL=openai/gpt-5-mini`. **Two paid Parallel
base calls** (the peer research, never cached) — stage 1 was a cache hit on
every run.

1. `cdfb825f` — `extracting -> benchmarking` claimed 08:14:33 (handle
   `run_06g2h2…`), `parallel run created` `{processor: base,
   parallel_run_id: trun_d5b71d81…073fd1}`, `peers gathered` 5 peers / 1
   reference, `benchmark stored` `rate_metric TRIR, rank 2, peer_count 3,
   calculative`, `completed` 08:16:59. Row: every peer carries the five
   fields; company TRIR 1.13 per million hours; comparable peers Emmi 21.96,
   Unilever 0.58, dsm-firmenich 1.24 (Mondelēz 0.24 has no basis and Olam no
   TRIR — both stored, neither ranked); read-layer `deriveRank` → rank 2 of
   3 peers = stored. `references` null: the one reference was on another
   base and was dropped (the judge pre-filter in D2 was added after this
   run; its rationale still mentions the dropped median — the later runs do
   not see such a figure).
2. `5ba1a856` — stage 1 `cache hit` (donor `cdfb825f`), stage 3 `parallel
   run created` `trun_d5b71d81…934c7a41` ≠ run 1's, no cache row in stage 3,
   5 peers / 0 references, rank 2 of 2 peers, `completed`.
3. `a13d4506` under `FORCE_STAGE3_EMPTY` — `peers gathered` 0/0 with
   `parallel_run_id null`, `benchmark stored` with `model null`, `completed`
   08:21:42; page renders "Insufficient benchmark data …".
4. `cdfb825f`'s page: "Rank 2 of 4 on TRIR", Badge "Calculative", verdict,
   rationale, peer table with `report.emmi.com`, `unilever.com` … links.
   Row set to `pathological` → page shows "Emerging" (2 hits), no
   "Pathological"; restored to `calculative`.
5. Session client on `benchmarks` for `cdfb825f`: owner A 1 row, user B 0
   rows; `anon` → "permission denied for table benchmarks".
6. `db push` applied the migration; `npx tsc --noEmit`, `pnpm lint`,
   `pnpm build` green.

## Files

New: `trigger/peer-benchmarking.ts`, `lib/parallel/peer-schema.ts`,
`lib/benchmark/{schema,judge}.ts`, `lib/runs/rank.ts`,
`lib/portal/benchmark.ts`, `components/dashboard/BenchmarkCard.tsx`,
migration `create_benchmarks_table`, this spec. Changed:
`lib/parallel/client.ts`, `trigger/company-research.ts`,
`trigger/kpi-extraction.ts`, `lib/runs/agent-log.ts`, `eslint.config.mjs`,
`app/dashboard/runs/[id]/page.tsx`, `.env.example`, context docs.
