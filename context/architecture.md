# Architecture

Surfaces, pipeline, data, auth/RLS. Stub — fill each section as the corresponding piece lands; a section with real content replaces its `(not built yet)` line.

## Surfaces

(not built yet)

## Pipeline

(not built yet — contract already fixed in `context/product/pipeline-rules.md`; this section fills with the engine diagram when code lands)

## Data

Postgres on Supabase (EU, eu-central-1). `supabase/migrations/` is the source of truth; `context/product/pipeline-rules.md` Data model describes intent only.

Built so far (`20260820114500_create_analysis_tables.sql`, `20260820123014_create_profiles_and_role_lock.sql`, `20260820171022_backfill_missing_profiles.sql`):

- `profiles` — `id → auth.users on delete cascade`, `role` (`client`|`expert`|`admin`, default `client`), `expert_status` (`none`|`pending`|`approved`|`rejected`, default `none`), `created_at`, `updated_at`. Written by trigger, locked against self-edit; see Auth / RLS below.

- `analysis_runs` — one row per search: `user_id → auth.users`, `company_name`, `company_domain`, `status` (enum = the run state machine), `processor` (`base`|`ultra`, default ultra), `cache_key`, `uploaded_report_path`, `research` jsonb (stage-1 output), `error`, `created_at`, `completed_at`. Partial index on `(cache_key, created_at)` for completed runs serves the stage-1 cache lookup.
- `kpis` — `run_id → analysis_runs`, canonical `metric`, `value`, `unit`, `period`, `source_url`, `source_excerpt`, `confidence` (`low|medium|high`), `origin` (`web|upload|client`); `unique (run_id, metric)`. This row shape is the read-layer interface.
- `agent_logs` — `run_id`, `stage`, `level` (`info|warn|error`), `message`, `payload` jsonb. Pipeline-internal only.

Still to come (own tickets): `benchmarks`, `expert_matches`, `proposals`, `ehs_documents` (pgvector), Storage buckets for uploads and proposal PDFs.

## Auth / RLS

Contract: `context/product/auth.md`. Supabase Auth (EU), passwordless — magic link and Google, no passwords anywhere. Three layers: Supabase proves identity, RLS guards rows, the proxy guards pages.

Ways in, both on `/login` (`components/portal/LoginCard`):

- Magic link — `requestMagicLink` (Server Action) calls `signInWithOtp` with `emailRedirectTo = <origin>/auth/confirm?next=…`. The email template sends `{{ .TokenHash }}`; `/auth/confirm` is a **page** rendering `MagicLinkConfirm`, whose POST (`confirmMagicLink`) calls `verifyOtp({ token_hash, type: 'email' })`. The token is spent on POST only, so a scanner's GET prefetch cannot consume it and the link works in a different browser than requested it.
- Google — `signInWithGoogle` calls `signInWithOAuth` with `redirectTo = <origin>/auth/callback?next=…`; the `/auth/callback` route handler runs `exchangeCodeForSession`.
- Failures land on `/login?error=link_expired|oauth_failed`; the page maps the code to human copy. No Supabase error text reaches the UI.
- `next` is validated by `lib/auth/safe-next.ts` (relative path only — one leading `/`, no `//`, no backslash, no scheme, no control chars); anything else falls back to `/auth/redirect`. Used by both returns, the login page, and the proxy.

Landing: `/auth/redirect` (route handler) reads `lib/auth/get-user.ts` → `{ user, profile }` and dispatches `admin` → `/admin`, `expert` → `/expert`, pending applicant → `/expert/apply`, else `/` (the client target becomes `/dashboard` with T-006). A session whose profile is missing is signed out there rather than looping.

Every request: `proxy.ts` → `lib/supabase/proxy.ts#updateSession` refreshes cookies via `getClaims()` (local JWT verification, no Auth round-trip; `getUser()` is reserved for live-truth moments). No session + `/dashboard`, `/expert`, `/admin` → `/login?next=<path>`; session + `/login` → `/auth/redirect`. `/auth/*` and non-GET requests are never redirected (a Server Action POST must reach its page). The proxy never reads `profiles`; role checks happen in pages and actions via `get-user.ts`. Logout is `signOut({ scope: 'local' })`.

RLS is the access boundary:

- `profiles` — one row per `auth.users` row, created by the `handle_new_user` trigger (`security definer`, `set search_path = ''`, owned by `postgres`). `authenticated` may `select` its own row only; `insert`/`update`/`delete` are revoked, so `role` and `expert_status` change only through the service role. Every column is privileged today, which is why there is no column-level update grant yet.
- `analysis_runs`: `authenticated` may `select` rows where `user_id = auth.uid()`.
- `kpis`: `authenticated` may `select` rows whose run they own.
- `agent_logs`: no policies and all grants revoked for `anon`/`authenticated` — clients never see pipeline internals.
- Writes: no write policies anywhere and `insert/update/delete` revoked from `anon`/`authenticated`; only the service role (used solely in `trigger/` and `app/api/webhooks/`) writes. The trigger route (T-003) will write through the service role after validating auth + ownership itself.
