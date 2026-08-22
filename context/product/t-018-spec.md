# T-018 spec — Stage 4 expert matchmaking

Decided 2026-08-22 before any code. This file records what was decided; it
does not reopen it. The acceptance criteria are the ticket's Check, quoted
verbatim below — nothing here restates or reinterprets it.

## Acceptance criteria

From `context/tickets.md`, T-018, verbatim:

> - What: `trigger/expert-matching.ts`, chained from stage 1 after benchmarking, moving `benchmarking -> matching -> completed` (stage 3 no longer writes `completed`). One Claude call (`Output.object`) derives the company's risk profile from its KPIs, sector and benchmark, then scores and ranks the approved experts (`profiles.role = expert` and `expert_status = approved`) by competency fit — top 3 with `score` 0–100 and a client-facing `rationale`; code validates the indices and writes `expert_matches` rows `{ run_id, expert_id, rank, score, rationale }` in one transaction. No Parallel call. Zero approved experts → zero rows, run still `completed`. Read layer + `ExpertMatchesCard` on the completed run page (name, headline, competencies, languages, availability, rationale); the expert surface lists the runs an expert was matched to (company, rank, date) through a `security definer` function so an expert never reads `analysis_runs` directly. RLS: the run owner reads its matches and the matched experts' rows; nobody else. Contract: `pipeline-rules.md` Stage 4.
> - Check: (1) migration pushed; `anon` holds no privilege on `expert_matches`; (2) a Nestlé `nestle.ch` cache-hit run (stage 3 under `FORCE_STAGE3_EMPTY` — no paid call) ends `completed` with `agent_logs` showing `benchmarking -> matching` claimed, one model call, and exactly 3 `expert_matches` rows, ranks 1–3, distinct approved experts, each with a score in 0–100 and a non-empty rationale; (3) with every expert set non-approved, a run ends `completed` with 0 rows and its page says no expert could be matched; (4) the run page renders the three matches with name, headline and rationale; through the session client user B reads 0 `expert_matches` rows for A's run and 0 of the matched `experts` rows, while A reads 3 and 3 and no unmatched expert; (5) the matched expert's `/expert` page lists the run (company name, rank), an unmatched expert's lists nothing; (6) `npx tsc --noEmit`, `pnpm lint`, `pnpm build` green, `ui-registry.md` updated.

## Standing facts this spec assumes

- Stage 3 wrote `benchmarking -> completed` (`t-016-spec.md` D1). Stage 1
  chains children with `triggerAndWait` and never rethrows a child failure.
- `experts` rows are owner-select only (`t-017-spec.md`); approval lives on
  `profiles` and is service-role written. Four fixture experts (Anna Keller,
  Luc Favre, Marco Bianchi, Sara Huber — `expert-{a,b,c,d}@example.test`)
  were created by service role for this ticket, approved, and left in place
  as the network until the admin surface lands.
- The stalled sweeper (`t-011-spec.md` D2) fails any working row whose
  handle is a `COMPLETED` Trigger.dev run.

## Decisions

### D1 — Stage 4 owns `completed`; stage 3 stops at `benchmarking`

Same handoff shape as T-016: stage 1 chains stage 4 after a successful stage
3; stage 4 claims `benchmarking|matching -> matching`, writes the matches,
and finishes `matching -> completed`. Stage 3's completion write moves here.

### D2 — One call: risk profile, then ranking by index

`lib/matching/judge.ts` sends the company (name, country, sector), its KPI
rows, the benchmark's label and verdict, and the approved experts as an
indexed catalogue (labels, not keys — the first live run echoed
`chemical_safety` into client-facing prose). The schema
(`lib/matching/schema.ts`) bounds the answer: a risk summary, up to six
needed competency keys, at most three matches by `expert_index` with an
integer score 0–100 and a rationale written to the company. Code maps
indices to rows and throws on an out-of-range or repeated index; the rank is
the position in the returned list. Candidates are `experts` rows whose
`profiles` row is `role = expert` and `expert_status = approved` — approval,
not application, admits an expert (`auth.md`).

`replace_expert_matches(p_run_id, p_matches)` deletes and inserts in one
transaction (the `replace_extracted_kpis` idiom), so a retry replaces rather
than duplicates; zero candidates call it with `[]` and skip the model.

### D3 — Who reads what

- `expert_matches`: owner-through-run select policy; `anon`/`authenticated`
  hold nothing else.
- `experts` gains a second select policy: the owner of a run may read the
  experts matched to it. The client sees the matched experts' public
  profile fields and no other expert; `lib/portal/matches.ts` joins the two
  in one PostgREST select and resolves catalogue keys to labels there, so
  the dashboard card imports nothing outside the read layer (the boundary
  rule refused the card's first draft, correctly).
- Experts read their side through `my_expert_matches()` — `security
  definer`, keyed on `auth.uid()` via `experts.user_id`, projecting `run_id`,
  `company_name`, `rank`, `matched_at`. An expert never gains a select on
  `analysis_runs`, whose rows carry `research` and `error`.

### D4 — The handle goes back to the parent between stages

Found live: with three chained children, a child that finishes and leaves
the row in a working status also leaves its own, now `COMPLETED`, run id as
the row's handle until the next child claims. A stalled-sweeper tick inside
that gap (`0c25b89a`, 3 s wide) read "working row, dead handle" and failed
the run — the sweeper working exactly as specified on a state the chain
should never produce. Stages 2 and 3 now end by writing `trigger_run_id =
ctx.run.parentTaskRunId` (guarded on their status and their own handle):
the parent is alive inside `triggerAndWait` until the next child claims and
overwrites it. `t-011-spec.md` D1's rule — the handle names the run
currently responsible for moving the row — holds at every instant again.
Stage 4, which writes `completed`, needs no hand-back; a future stage 5 will
hand back the same way.

The zombie that the failed run left — its parent waiting on a stage-3
child retrying against a `failed` row — held user A's concurrency slot until
cancelled by hand; the retrying child's claim correctly refused the terminal
row each time.

## Verification record

2026-08-22, dev environment, migration `20260822083347_create_expert_matches`
pushed, worker `FORCE_STAGE3_EMPTY=1 PIPELINE_MODEL=openai/gpt-5-mini` — no
Parallel call in any run below; stage 1 hit cache every time.

1. `anon` on `expert_matches` → "permission denied for table expert_matches".
2. `5368d134` — `benchmarking -> matching` claimed 08:37:28 (`candidates:
   4`), `matches stored` with `model: openai/gpt-5-mini`, `written: 3`,
   `completed` 08:38:08. Rows: rank 1 Luc Favre 64, rank 2 Anna Keller 59,
   rank 3 Sara Huber 58 — three distinct experts, scores in range,
   rationales 276–359 chars.
3. All four experts set `pending` → `36f8583a`: `candidates: 0`, `written:
   0`, no model call, `completed`; page reads "No expert matched yet — No
   approved expert in our network fits this profile yet…"; 0 rows. Experts
   re-approved afterwards.
4. `5368d134`'s page renders "Who can help" with #1 Luc Favre + headline +
   rationale, competency badges, languages/regions/years. Session reads: A →
   3 matches, `experts` visible = exactly the three matched names; B → 0
   matches, 0 experts.
5. `/expert` as `expert-b@example.test` (rank 1) → "1 report name you",
   row Nestlé S.A. #1 22.08.2026; as `expert-c@example.test` (unmatched) →
   "No matches yet".
6. After D4's fix, `ecc02e74` showed the handle sequence `researching
   parent → extracting child → extracting parent → benchmarking child →
   benchmarking parent → matching child → completed`, and the rationales
   now read "chemical & process safety, occupational health…" (labels).
   `npx tsc --noEmit`, `pnpm lint`, `pnpm build` green.

## Files

New: migration `create_expert_matches`, `lib/matching/{schema,judge}.ts`,
`trigger/expert-matching.ts`, `lib/portal/matches.ts`,
`components/dashboard/ExpertMatchesCard.tsx`,
`components/expert/ExpertMatchesList.tsx`, this spec. Changed:
`trigger/company-research.ts`, `trigger/peer-benchmarking.ts`,
`trigger/kpi-extraction.ts` (hand-back), `lib/runs/agent-log.ts`,
`lib/experts/read.ts`, `app/expert/page.tsx`,
`app/dashboard/runs/[id]/page.tsx`, context docs.
