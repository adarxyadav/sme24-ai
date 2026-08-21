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
- Two clients only: `lib/supabase/server.ts` (`createClient()`, cookie-bound, RLS-scoped — Server Components, Server Actions, route handlers) and `lib/supabase/proxy.ts` (`updateSession`, called from root `proxy.ts` to refresh cookies on every request). No browser client until something needs one. A service-role client lands with `trigger/` and lives only there + `app/api/webhooks/`.
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

## Parallel Task API

- Async only: create run → poll/webhook. Processor tiers and caching rules are owned by `context/product/pipeline-rules.md`. Receives only public company names — never customer data.
