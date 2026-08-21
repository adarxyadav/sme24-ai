# Library docs

Project-specific rules per third-party library — the gotchas and conventions that go beyond the library's own docs. Read the library's section here before using it; add a section when a library earns its first project-specific rule.

## Tailwind CSS 4

- Dark mode is the default `prefers-color-scheme` variant — no `@custom-variant dark`, no `.dark` class. Tokens flip in `app/globals.css`; app code never writes `dark:`.
- Token table and typography scale: `context/design.md`.

## shadcn/ui

- Initialised with `components.json`: style `radix-nova`, base color neutral, CSS variables, Lucide icons, aliases `@/components/ui`, `@/lib/utils`.
- Add primitives with `npx shadcn@latest add <name>`; they land in `components/ui/` and are app-owned — edit freely, but keep semantic token classes only. Register each in `context/ui-registry.md`.
- The shadcn init's `@custom-variant dark (&:is(.dark *))` line was removed on purpose (see Tailwind above); don't let a future `init` re-add it.

## Supabase

- EU project (eu-central-1, Frankfurt). Keys are the new `sb_publishable_…` / `sb_secret_…` pair — never the legacy anon/service_role JWTs. Env names in `.env.example`.
- Three clients: `lib/supabase/server.ts` (`createClient()`, cookie-bound, RLS-scoped — Server Components, Server Actions, route handlers), `lib/supabase/proxy.ts` (`updateSession`, called from root `proxy.ts` to refresh cookies on every request), and `lib/supabase/service.ts` (`createServiceClient()`, service-role). No browser client until something needs one.
- The service-role client bypasses RLS, so its callers owe every check RLS would have made. Permitted callers: `trigger/` tasks, `app/api/webhooks/`, and `app/api/` route handlers that authenticate the session themselves and derive `user_id` from it — never from the request body. `app/api/` is on that list because `authenticated` holds no insert grant on `analysis_runs`, so the trigger route has no alternative (`t-003-spec.md` D3). It imports `server-only`, so an import from a Client Component fails the build rather than shipping the secret.
- Read the user with `supabase.auth.getClaims()` (verifies the JWT locally), never `getSession()`; `getUser()` only when fresh server-side truth is required.
- Schema changes are migrations in `supabase/migrations/` via `npx supabase` (CLI is not installed globally): `npx supabase link`, `npx supabase db push`; fresh-DB proof via `npx supabase db reset --linked`. Never edit the hosted schema in the dashboard.
- Always create migrations with `npx supabase migration new <snake_case_description>` — never hand-write the filename. The CLI stamps a real UTC timestamp to the second; invented round-hour prefixes collide across branches and misorder the ledger. Name the change after what it does, verb-led: `create_profiles_and_role_lock`, `add_runs_status_index`, `backfill_missing_profiles` — not noun-led (`profiles_auth`, `runs_index`).
- To rename an applied migration: rename the file, then `npx supabase migration repair --status applied <new>` and `--status reverted <old>`. Repair only rewrites the ledger — the DDL never re-runs and data is untouched — so verify with `db push --dry-run` reporting `upToDate`.
- Every table: RLS enabled, `select` policies written against `(select auth.uid())`, no write policies for `anon`/`authenticated` and the write grants revoked — writes happen only through the service role.
- Auth: the contract is `context/product/auth.md` — read it before touching an auth path. `signInWithOtp` + a `/auth/confirm` page calling `verifyOtp({ token_hash })`, never `{{ .ConfirmationURL }}` links; OAuth returns through `exchangeCodeForSession` in a route handler.
- Supabase now requires custom SMTP before the email templates can be edited, and the token-hash flow depends on an edited template — so Resend SMTP is configured from day one, not at launch (`auth.md` Cast updated). Dev sender is `onboarding@resend.dev`, which only delivers to the Resend account's own address.
- Auth config that lives in the dashboard, not in code: email confirmation is **off** until launch (tracked under Later in `tickets.md`); redirect allowlist, provider secrets and email templates likewise (`auth.md` Dashboard configuration).
- Server Actions rendered by the root layout (the header's Log out form) must be reachable on POST — the proxy skips non-GET requests for exactly this reason.
- Dev gotcha: repeated broken-state sign-ins leave stale chunked `sb-…-auth-token.N` cookies on `localhost`; once the header total passes ~8 KB every request dies with HTTP 431 and Server Actions surface as "An unexpected response was received from the server". Clear the site's cookies (or use `127.0.0.1:3000`) rather than changing code.

## Vercel AI SDK + AI Gateway

- Gateway model strings are `provider/model` with version dots kept as dots (e.g. `anthropic/claude-sonnet-5`) — never rewrite dots to dashes.
- `PIPELINE_MODEL` env var overrides the pipeline model for testing; production model choice is owned by `context/product/pipeline-rules.md`.
- Structured output via `Output.object` + Zod, per the pipeline contract.

## Trigger.dev v4

- All AI calls live in `trigger/` tasks (AGENTS.md rule); pipeline task semantics (chaining, retries, queues) are owned by `context/product/pipeline-rules.md`.
- Project `sme24-ehs`, config in `trigger.config.ts` (`dirs: ["./trigger"]` — `init` defaults to `./src/trigger`, which this repo does not have, and scaffolds an example task using `any`; delete both).
- **Region is per-run, not per-project.** Every project can reach every region; `region` is a `TriggerOptions` field and the project holds a *default* used when a call names none. That default is `eu-central-1` (Frankfurt, matching Supabase), **and** each trigger site passes `region: "eu-central-1"` explicitly — the dashboard default is invisible in the repo, and customer data stays in EU regions (`pipeline-rules.md`).
- **Queues: declare on the task, reference when triggering.** `concurrencyLimit` exists only on the task definition; at the trigger site `queue` is a plain `string`. Naming a queue there that no task declares leaves runs stuck in `PENDING_VERSION`. Queue names live in `lib/runs/queues.ts` so a route can reference one without importing task code.
- Per-user concurrency is `concurrencyKey` at the trigger site, which copies the queue per unique value — not a second queue and not a global limit.
- Route handlers enqueue with `tasks.trigger<typeof someTask>("task-id", payload, opts)` and **`import type`** for the task. A value import evaluates the task module and pulls its dependencies (the Parallel client, the service-role client) into the route bundle; this builds without complaint, so nothing catches it for you.
- `onFailure` fires once, after retries are exhausted — the only correct place to write a terminal `failed`. A `catch` inside `run()` fires on the first attempt and is then contradicted by a retry that succeeds.
- The CLI's task table stays empty until a run arrives; an empty table is not proof the task failed to register. The `■ Error:` line wrapping Node's `--localstorage-file` warning is stderr noise, not a build failure.
- `TRIGGER_SECRET_KEY` is per-environment (`tr_dev_…` locally). `npx trigger.dev@latest dev` must be running or a triggered run simply waits.

## Parallel Task API

- Async only: create run → poll/webhook. Processor tiers and caching rules are owned by `context/product/pipeline-rules.md`. Receives only public company names — never customer data.
- We poll, we do not use webhooks (`t-004-spec.md` D7). `GET /v1/tasks/runs/{id}/result?timeout=N` **long-polls** — it blocks server-side until the result is ready and returns 408 when the window closes — so the loop is a few blocking reads with no sleep between them, not a busy wait.
- Plain `fetch` in `lib/parallel/`, not the `parallel-web` SDK: two endpoints, and the SDK's value here is the polling loop we write anyway to bound it against the task's `maxDuration`.
- JSON output mode is `task_spec.output_schema = { type: "json", json_schema: {...} }`. Schema descriptions are read as instructions by the model — they are the difference between a disclosed figure and an invented one, so write them as such.
- Provenance comes back as `output.basis[]`: per-field `{ field, citations[{url, title, excerpts[]}], reasoning, confidence }`. Stored verbatim alongside our parsed output so it is never lossily re-derived.
- Every response is parsed with a Zod mirror of the JSON schema before anything is written — a provider-side shape change should surface as a task failure, not as malformed jsonb a later stage trips over.
