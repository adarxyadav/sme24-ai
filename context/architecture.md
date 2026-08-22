# Architecture

Surfaces, pipeline, data, auth/RLS. Stub — fill each section as the corresponding piece lands; a section with real content replaces its `(not built yet)` line.

## Surfaces

Built so far: the marketing page with the search form (`/`), the auth pages, and the client dashboard (`/dashboard` run list, `/dashboard/runs/[id]` run detail with the KPI ledger). Expert and admin surfaces are Later.

**The read-layer boundary** (`t-006-spec.md` D1). Three tiers, each a directory, enforced by `no-restricted-imports` in `eslint.config.mjs` so `pnpm lint` fails on a crossing:

| Tier | Directories | May import |
|---|---|---|
| Engine | `trigger/`, `lib/parallel/`, `lib/extraction/`, `lib/runs/` (except `metrics.ts`), `lib/supabase/service.ts` | anything |
| Read layer | `lib/portal/` | `lib/supabase/server.ts` (the session client), `lib/runs/metrics.ts` (the contract constants) |
| Dashboard | `app/dashboard/`, `components/dashboard/` | `lib/portal/`, `lib/utils.ts`, `components/ui/` |

The dashboard cannot reach a Supabase client, so "reads only through the read layer" is structural. The read layer selects explicit column lists that never include `error`, `research`, `cache_key`, `processor` or `uploaded_report_path`; RLS (below) is its only row filter — no `user_id` predicate anywhere, so another user's run is a zero-row result and the page renders not-found. `lib/portal/run-state.ts` maps the nine-value `run_status` enum onto five render states with an exhaustive `Record`; the `failed` state is fixed copy. No derivation from `kpi-contract.md` is computed yet (Later).

## Pipeline

Contract: `context/product/pipeline-rules.md`. Orchestrated by Trigger.dev v4 — project `sme24-ehs`, default region `eu-central-1` (Frankfurt, matching Supabase); each trigger site also names the region explicitly. Config in `trigger.config.ts` (`dirs: ["./trigger"]`, retry backoff ≥ 60s).

Built so far — **stages 1 and 2** (`trigger/company-research.ts`, `trigger/kpi-extraction.ts`):

```
POST /api/runs ──> create_analysis_run()      run row + client kpis, one transaction
               └─> tasks.trigger("company-research", { runId })   best-effort
                     queue "company-research" (concurrencyLimit 1)
                     concurrencyKey = userId          -> one run at a time per user
                     on throw: agent_logs row, still 201 — the sweeper recovers it

sweep-queued-runs task (cron */5, UTC)
  selects status='queued' older than 5 min   -> re-triggers, same queue + concurrencyKey
  3 recorded enqueue failures                -> failed + error + agent_logs row
                                               (failures, not sweeps: a run waiting
                                                behind concurrency-1 is healthy)

sweep-stalled-runs task (cron */5, UTC)
  selects every working-status row         researching|extracting|benchmarking|matching|generating
  runs.retrieve(trigger_run_id)            one call per row, page of 100
  alive (PENDING_VERSION/QUEUED/DELAYED/    -> untouched; no age threshold
         DEQUEUED/EXECUTING/WAITING)
  dead  (COMPLETED/CANCELED/FAILED/CRASHED/ -> failed + error + agent_logs row, guarded on
         SYSTEM_FAILURE/TIMED_OUT/EXPIRED)     working status AND the handle it asked about
  null handle                              -> dead by construction (no task ever claimed it)
  unknown (404 = other environment's run,  -> agent_logs warn, no write
           thrown request, unmapped status)

company-research task
  queued -> researching        claim: conditional update, attempted for every
                               `reason: start` trigger regardless of the status
                               read. The winner proceeds, a redundant trigger
                               exits without calling Parallel. An escalation
                               re-run is exempt and never rewinds a status.
                               The same update writes trigger_run_id = ctx.run.id,
                               the handle the stalled sweeper asks about. A retry
                               (same run id) re-wins: `researching` + own handle
                               is accepted, any other handle loses (T-012).
  1. read client kpis          origin='client', already written by the route — never re-written
  2. cache lookup              cacheKey() -> newest completed run, same key, < 30 days
                               ultra ignores a base donor; a hit copies `research` only
  3. on miss: Parallel ultra   create run -> blocking-GET result loop (no webhook)
                               public company name + domain only
  4. (uploaded-PDF override — not built; see tickets.md Later)
  -> research jsonb            { schema_version, source, output, basis[], parallel_run_id, cache? }
  -> no_data                   iff 0 findings AND no disclosure AND no client kpis AND no upload
  -> otherwise: kpiExtractionTask.triggerAndWait({ runId })
                               the wait releases the per-user slot and is excluded
                               from maxDuration; a child failure is logged (warn),
                               never thrown — stage 2's own hook wrote `failed`

  onFailure  (retries exhausted) -> status failed + error column + agent_logs row
  onCancel   (cancelled/crashed) -> same, from non-terminal statuses only

kpi-extraction task (own default queue, no concurrency key)
  researching|extracting -> extracting   conditional; 0 rows = run is elsewhere, throw;
                                         overwrites trigger_run_id with the child's id —
                                         at `extracting` the child decides liveness
  1. read research + client kpis   from this run's row — never the cache donor
  2. model maps findings           ai generateText + Output.object, anthropic/claude-sonnet-5
                                   via the Gateway; enum derived from lib/runs/metrics.ts;
                                   lost_time_injuries never web-filled
  3. code projects rows            value/unit/period/url/excerpt/confidence copied from the
                                   named finding; null value, bad index, duplicate or
                                   non-canonical metric -> throw (nothing written)
  4. replace_extracted_kpis()      one transaction: delete origin<>'client', insert the
                                   metrics the client did not supply (anti-join)
  extracting -> completed          conditional, completed_at set; the run is now a cache donor
  onFailure / onCancel             as stage 1; onCancel from `extracting` only
```

The payload is `{ runId }` alone — company name, domain, processor and upload path are read from the row, so a retry or escalation re-run always sees current values. `error` is internal-facing and no read path selects it.

`queued` is the one status with no task inside it, so it gets an external owner: `onFailure` and `onCancel` only fire once a task has started, leaving a run that never reached a worker (failed enqueue, `PENDING_VERSION` after a deploy skew, a worker dying pre-attempt) stuck forever. The sweeper closes that. The database is the authority for whether work already started — the conditional `queued -> researching` claim — rather than Trigger.dev's idempotency store, which clears a failed run's key and expires at 30 days.

The working statuses have a task inside them, but the task's hooks do not cover a crash, a system failure, a worker that dies, or a platform-side cancellation with no worker to run `onCancel` — the row then holds a working status forever. The stalled sweeper (`trigger/sweep-stalled-runs.ts`, `t-011-spec.md`) owns those: every claim writes the Trigger.dev run id into `trigger_run_id`, and the sweeper asks `runs.retrieve` whether that run is still alive; nothing is decided by age, because a run may legitimately hold `researching` for the task's full `maxDuration`. Its write is conditional on both the working status and the handle it asked about, so a terminal written by a hook, or a stage-2 claim that replaced the handle, always wins. Uncertainty (a thrown or 404 `retrieve` — a 404 is what another Trigger.dev environment's run looks like, since the database is shared and the secret keys are not) never fails a run.

## Data

Postgres on Supabase (EU, eu-central-1). `supabase/migrations/` is the source of truth; `context/product/pipeline-rules.md` Data model describes intent only.

Built so far (`20260820114500_create_analysis_tables.sql`, `20260820123014_create_profiles_and_role_lock.sql`, `20260820171022_backfill_missing_profiles.sql`, `20260821090607_revoke_anon_select_on_analysis_tables.sql`, `20260821110530_create_analysis_run_function.sql`, `20260821153519_index_queued_runs_for_sweep.sql`, `20260821163842_create_replace_extracted_kpis_function.sql`, `20260822064803_add_trigger_run_id_for_stalled_sweep.sql`):

- `profiles` — `id → auth.users on delete cascade`, `role` (`client`|`expert`|`admin`, default `client`), `expert_status` (`none`|`pending`|`approved`|`rejected`, default `none`), `created_at`, `updated_at`. Written by trigger, locked against self-edit; see Auth / RLS below.

- `analysis_runs` — one row per search: `user_id → auth.users`, `company_name`, `company_domain`, `status` (enum = the run state machine), `processor` (`base`|`ultra`, default ultra), `cache_key`, `uploaded_report_path`, `research` jsonb (stage-1 output), `error`, `trigger_run_id` (the Trigger.dev run currently responsible for the row, written inside each claim), `created_at`, `completed_at`. Partial index on `(cache_key, created_at)` for completed runs serves the stage-1 cache lookup. Partial indexes on `(created_at)` for `queued` rows and for working-status rows serve the two sweepers' scans.
- `kpis` — `run_id → analysis_runs`, canonical `metric`, `value`, `unit`, `period`, `source_url`, `source_excerpt`, `confidence` (`low|medium|high`), `origin` (`web|upload|client`); `unique (run_id, metric)`. This row shape is the read-layer interface.
- `agent_logs` — `run_id`, `stage`, `level` (`info|warn|error`), `message`, `payload` jsonb. Pipeline-internal only.
- `create_analysis_run(p_user_id, p_company_name, p_company_domain, p_cache_key, p_kpis jsonb) returns uuid` — the trigger route's only write: the `analysis_runs` row plus the client `kpis` rows in one transaction. Not `security definer`; `execute` granted to `service_role` alone.
- `replace_extracted_kpis(p_run_id, p_kpis jsonb) returns integer` (`20260821163842`) — stage 2's only KPI write: deletes the run's `origin <> 'client'` rows and inserts the given rows for metrics no client row holds, in one transaction. Client rows keep their `id`/`created_at` across retries. Same privilege model.

Still to come (own tickets): `benchmarks`, `expert_matches`, `proposals`, `ehs_documents` (pgvector), Storage buckets for uploads and proposal PDFs.

## Auth / RLS

Contract: `context/product/auth.md`. Supabase Auth (EU), passwordless — magic link and Google, no passwords anywhere. Three layers: Supabase proves identity, RLS guards rows, the proxy guards pages.

Ways in, both on `/login` (`components/portal/LoginCard`):

- Magic link — `requestMagicLink` (Server Action) calls `signInWithOtp` with `emailRedirectTo = <origin>/auth/confirm?next=…`. The email template sends `{{ .TokenHash }}`; `/auth/confirm` is a **page** rendering `MagicLinkConfirm`, whose POST (`confirmMagicLink`) calls `verifyOtp({ token_hash, type: 'email' })`. The token is spent on POST only, so a scanner's GET prefetch cannot consume it and the link works in a different browser than requested it.
- Google — `signInWithGoogle` calls `signInWithOAuth` with `redirectTo = <origin>/auth/callback?next=…`; the `/auth/callback` route handler runs `exchangeCodeForSession`.
- Failures land on `/login?error=link_expired|oauth_failed`; the page maps the code to human copy. No Supabase error text reaches the UI.
- `next` is validated by `lib/auth/safe-next.ts` (relative path only — one leading `/`, no `//`, no backslash, no scheme, no control chars); anything else falls back to `/auth/redirect`. Used by both returns, the login page, and the proxy.

Landing: `/auth/redirect` (route handler) reads `lib/auth/get-user.ts` → `{ user, profile }` and dispatches `admin` → `/admin`, `expert` → `/expert`, pending applicant → `/expert/apply`, else `/dashboard`. A session whose profile is missing is signed out there rather than looping.

Every request: `proxy.ts` → `lib/supabase/proxy.ts#updateSession` refreshes cookies via `getClaims()` (local JWT verification, no Auth round-trip; `getUser()` is reserved for live-truth moments). No session + `/dashboard`, `/expert`, `/admin` → `/login?next=<path>`; session + `/login` → `/auth/redirect`. `/auth/*` and non-GET requests are never redirected (a Server Action POST must reach its page). The proxy never reads `profiles`; role checks happen in pages and actions via `get-user.ts`. Logout is `signOut({ scope: 'local' })`.

RLS is the access boundary:

- `profiles` — one row per `auth.users` row, created by the `handle_new_user` trigger (`security definer`, `set search_path = ''`, owned by `postgres`). `authenticated` may `select` its own row only; `insert`/`update`/`delete` are revoked, so `role` and `expert_status` change only through the service role. Every column is privileged today, which is why there is no column-level update grant yet.
- `analysis_runs`: `authenticated` may `select` rows where `user_id = auth.uid()`.
- `kpis`: `authenticated` may `select` rows whose run they own.
- Grants start open, not closed: `pg_default_acl` gives `anon`, `authenticated` and `service_role` every privilege on each new table in `public`. So every new table opens with `revoke all on <table> from public, anon, authenticated;` and then grants back only what that table needs — never a partial revoke listing single privileges, which is how `analysis_runs`/`kpis` kept `anon`'s default `select` until `20260821090607`. Denying at the grant keeps RLS from being the only layer.
- `agent_logs`: no policies and all grants revoked for `anon`/`authenticated` — clients never see pipeline internals.
- Writes: no write policies anywhere and `insert/update/delete` revoked from `anon`/`authenticated`; only the service role (`lib/supabase/service.ts`, used in `trigger/`, `app/api/webhooks/`, and the trigger route) writes. `app/api/runs` writes through it after authenticating the session, taking `user_id` from the verified claims and never from the body. Both of its writes — the run row and the client `kpis` rows — go through `create_analysis_run(...)`, one transaction, so a run can never exist without the client figures it was started with.
