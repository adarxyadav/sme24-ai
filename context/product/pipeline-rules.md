# Pipeline rules

The AI pipeline contract: stages, inputs/outputs, caching, failure handling. Pipeline code follows this file, not the other way around. Rationale and provenance live in the Decision log at the bottom — the sections above it are pure rules.

**Workflow, not agent.** A fixed five-stage assembly line, always the same order — no AI decides what to do next. Predictable and debuggable beats creative in a client-facing sales document.

**Math is code, judgment is AI.** The dashboard never talks to the engine — stages write rows; the read layer (`lib/portal/`, RLS-scoped) renders them. Rank, peer count, and the annual incident cost in CHF are derived in code from stored rows at display time; the loss model's cost constants live in code with cited sources (`kpi-contract.md`). AI emits findings, judgments, and rationale — never arithmetic code can do.

## Stack

| Concern | Tool |
|---|---|
| Orchestration | Trigger.dev v4 — all stages are tasks |
| Model layer | Vercel AI SDK + AI Gateway — model `anthropic/claude-sonnet-5`, one model for every Claude call in the pipeline; `PIPELINE_MODEL` env override for testing |
| Web research / KPIs | Parallel Task API (async: create run → poll/webhook) |
| Structured output | AI SDK `Output.object` + Zod schema |
| Expert matching | Claude structured ranking over the `experts` table (no vector DB) |
| EHS Vault | Supabase pgvector RAG — grounds the proposal |
| Proposal PDF | `@react-pdf/renderer` → Supabase Storage |

## Hard rules

Inherited from AGENTS.md (the owner — not restated here): AI only in `trigger/` tasks, pipeline errors to `agent_logs` never the UI, metadata in Postgres / binaries in Storage with signed URLs.

Pipeline-specific:

- The trigger route validates input + ownership, then enqueues — it never calls AI.
- RLS is the access boundary: reads RLS-scoped; service-role writes only in `trigger/`, `app/api/webhooks/`, and the trigger route, which authenticates the session and derives `user_id` from it before writing (`library-docs.md`, Supabase).
- Customer data + artifacts stay in EU regions. Parallel receives only a public company name; uploaded reports never leave Supabase.
- Company research runs the **ultra** Parallel processor; `processor: 'base'` only by explicit override.
- Never present a guessed number as fact — every KPI stores source + confidence. A client overrides any value by re-running the search with client-supplied KPIs (client rows always win).

## Run state machine

`queued → researching → extracting → benchmarking → matching → generating → completed`, with terminals `failed` and `no_data`.

- An escalation re-run (see Escalation) keeps the run in its current status — the machine only moves forward.
- `failed` is set by the failing task's final-failure hook (retries exhausted): write status + the `error` column + an `agent_logs` row. The UI shows a generic delayed notice, never the error.
- `no_data` is set only by stage 1.

## Stages

Each stage is a Trigger.dev task with its own retry; stages chain via `triggerAndWait`. Stages 1 and 2 stay separate tasks — distinct retry and escalation semantics — even though Parallel can return structured KPIs directly.

### 1 — Company research
- **In:** `{ runId, companyName, companyDomain?, clientContext?, clientKpis?, uploadedReportPath? }`
- **Do**, in order:
  1. Record client-supplied KPIs as `kpis` rows (`origin: 'client'`, `confidence: 'high'`) — before the cache check, so they exist even on a cache hit.
  2. Cache check (see Caching); on a hit, skip the Parallel call.
  3. On a miss: run Parallel web-first with an EHS output schema → structured findings incl. `sector` (NACE code, best-effort — stage 3's input) + `basis[]` citations + per-field confidence.
  4. If the client uploaded a report (PDF only, v1 — already in Supabase Storage, path on the run row), read it with Claude; it overrides the web result for any field it covers.
- **Out:** `research` jsonb on the `analysis_runs` row (findings + provenance + sector) + any client `kpis` rows.
- **Fail:** no web data and no upload → terminal `no_data`; the UI shows the standard no-data notice (copy lives in the read layer, nothing pipeline-generated).

### 2 — KPI extraction
- **In:** stage-1 `research` (the upload override is already merged into it).
- **Do:** normalize to the canonical KPIs (`kpi-contract.md` owns the list). `Output.object` + Zod. Extraction fills only metrics the client didn't supply — on conflict the client value wins. KPI writes are one atomic swap that touches only non-client rows, so client KPIs survive retries.
- **Out:** `kpis` rows `{ metric, value, unit, period, source_url, source_excerpt, confidence, origin: 'web' | 'upload' | 'client' }` — this row shape is the read-layer interface; the UI marks client rows "Client-provided".

### 3 — Peer benchmarking
- **In:** company KPIs + `sector` from stage-1 research.
- **Do:** gather peer/industry figures (Parallel, never cached) → Claude emits the judgment: maturity label + rationale, a one-to-two-sentence verdict, and the peer list. Code derives the arithmetic from that stored peer list: `rank`/`peer_count`, rank 1 = lowest rate = safest; the read layer re-derives both from the same rows at display time so figure and chart can't disagree. No percentile — rank carries it.
- **Comparability rules:**
  - Never convert a rate across metrics or bases.
  - Each peer carries `trir` AND `ltifr`, reporting year, figure scope (`employees` | `combined` | null), and `source_url` (peer citations join the report's Data sources).
  - `rate_metric` (`TRIR` | `LTIFR`) names what the set ranks on — TRIR preferred; LTIFR only when that's what company + peers share on the same base.
  - `references` (industry median + best-in-class) are set ONLY on the same metric + base as `rate_metric`.
  - Official per-1000-FTE all-accident stats (e.g. SUVA's) are not TRIR-comparable — excluded until a client methodology call admits them.
  - No peer discloses (typical SME case) → the UI renders on `references` alone. Neither peers nor references → the benchmark section states insufficient data; the run continues.
- **Out:** `benchmarks` record `{ peer_count, rank, verdict, maturity_label, maturity_rationale, per_metric_comparison }` — `rate_metric`, `references`, and peer metadata live inside `per_metric_comparison`.
- **Maturity scale:** Hudson/Bradley 5-rung — Pathological → Reactive → Calculative → Proactive → Generative. The pipeline always emits Hudson labels; the read layer renders the bottom rung as "Emerging" (deliberate client-facing softening).

### 4 — Expert matchmaking
- **In:** company risk profile — derived inside the call from KPIs + sector.
- **Do:** Claude structured call → risk → competency tags → score & rank approved experts. Top-3.
- **Out:** `expert_matches` rows `{ expert_id, rank, score, rationale }`.

### 5 — Proposal generation
- **In:** research + benchmark + matched experts + package definitions (tier source of truth: `context/product/packages.md`).
- **Do:** Claude (`Output.object`) drafts the proposal, grounded by EHS Vault retrieval (pgvector); an empty vault degrades to ungrounded drafting — seeding the vault is admin scope, not a pipeline concern. Render with `@react-pdf` → upload to Supabase Storage.
- **Out:** `proposals` record `{ content jsonb, pdf_path }`. No visibility flag — a proposal is visible iff its run completed; RLS keys on run ownership.

## Data model

Initial shape — once `supabase/migrations/` exists, the DDL owns it:

- `analysis_runs` — id, user_id, company_name, company_domain, status, processor, cache_key, uploaded_report_path, created_at, completed_at, error
- `kpis`, `benchmarks`, `expert_matches`, `proposals` — FK to `analysis_runs`
- `agent_logs` — run_id, stage, level, message, payload, created_at
- `ehs_documents` — vault: content, embedding vector, metadata (pgvector)

RLS: owner reads own run + children; expert/admin grants spelled out in the DDL; writes service-role only.

## Quota

Per-user Trigger.dev queue with concurrency 1 → one run at a time per user. This is the only throttle — no hand-rolled lock, no monthly cap. The real external bound is the Parallel tier.

## Caching

- **Cached:** stage-1 research only (the paid Parallel call). Stages 3–5 always regenerate; peer research is never cached.
- **Key:** `cache_key` = normalized `company_domain` if present, else normalized `company_name`. One implementation owns the rule — `lib/runs/cache-key.ts` — so the trigger route and stage 1 cannot drift apart. Normalize, in order: NFC-normalize, then trim, lowercase, collapse inner whitespace to single spaces. A domain additionally loses its scheme, a leading `www.`, any path, query or fragment, any port, and one trailing dot; it is parsed with `URL`, and a domain that will not parse falls back to the name branch. NFC comes first because the same company typed on macOS and on Windows otherwise yields two keys and silently misses cache.
- **Mechanics:** no cache table — a hit copies the `research` jsonb from the newest completed run with the same `cache_key` no older than 30 days, then stage 2 runs normally on the copy (so the current run's client-KPI merge still applies). Shared across all clients: one company = one paid Parallel run per window.
- **Tier rule:** an ultra run ignores cached *base* research and refreshes the cache with its fresh result; cached ultra research is reused as-is.

## Escalation

Base → ultra, once only, agent-logged every time; the run's status does not move during a re-run:

- **Company research** — applies only to explicit `processor: 'base'` runs (ultra is the default). Trigger: zero numeric web KPIs after extraction → re-run stages 1–2 on ultra.
- **Benchmark peer call** — base by default. Trigger: no numeric peer TRIRs/LTIFRs → retry the peer gathering on ultra.
- Model-call retry backoff ≥ 60s.

## Trigger route (`app/api/`)

POST validates: authenticated, input shape (optional `kpis[]` — canonical metrics, deduped by metric; optional uploaded-report Storage path owned by the caller), ownership → inserts an `analysis_runs` row (`queued`) → `tasks.trigger()` stage 1 → returns `runId`.

## Decision log

Dates = when settled in the old product; all re-confirmed for the rebuild 2026-08-17. Rationale lives here, not in the rules above.

- **Web-first, always** (2026-06-29) — rejected: upload-as-primary. Uploads are a backup + accuracy override, PDF only for v1 (Excel/CSV later if asked).
- **Client KPIs optional** (2026-07-07) — rejected: mandatory intake, PDF-as-input, free-text fields. Zero-friction funnel wins.
- **One model, no mixing** (2026-07-08) — per-stage model spread saves rappen against a CHF 4'800+ sale; not worth the branches.
- **Peer research uncached** (2026-07-08) — free-text sector keys and stale peers under a client-visible rank; the saving is nil.
- **Ultra default for company research** (2026-07-13) — base demonstrably missed disclosed KPIs. Same call added the cache tier rule: without it, a cached base result would shadow the ultra default for 30 days on any previously-searched company.
- **Comparability round** (2026-07-15) — rank only same-metric, same-base; official all-accident stats excluded pending a client methodology call.
- **No monthly cap** (2026-07-22) — per-user concurrency 1 is the throttle.
- **Auto-release** (2026-07-22) — rejected: editorial gate. The rebuild carries no release machinery at all.
- **AI expert ranking** (2026-08-17) — rejected: deterministic scoring. Matching is judgment; the rationale doubles as client-facing copy.
- **CHF loss in code** (2026-08-17) — rejected: an AI cost-estimate stage. No AI-invented francs in a sales document.
- **Stages 1+2 stay separate** (2026-08-17) — rejected: collapsing into one Parallel task. Separate retry + escalation semantics and a stable state machine outweigh the merge.
