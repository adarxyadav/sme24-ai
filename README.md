# SME24

AI-powered EHS (environment, health & safety) consulting marketplace for the Swiss market.

A client enters their company name and a background pipeline does the rest: researches public disclosures, extracts safety KPIs, benchmarks them against industry peers, matches senior EHS experts, and generates a consulting proposal PDF — all delivered free in the client dashboard, which also derives the annual cost of incidents in CHF from the stored results.

The free report is the funnel; revenue comes from four fixed-price consulting packages — three sold via Stripe Checkout with Swiss MWST, one priced on request via contact form. Tier definitions live in [context/product/packages.md](context/product/packages.md).

Three user roles share the app — **clients**, **experts**, and **admins** — each with their own surface.

## Stack

- Next.js 16 (App Router) + React 19, TypeScript strict
- Tailwind CSS 4
- Supabase (EU) — Postgres + RLS, Auth; migrations in `supabase/migrations/` via `npx supabase`
- pnpm
- Supabase Storage (private buckets `uploads`, `proposals`; signed URLs only) + pgvector (the EHS Vault)
- Trigger.dev v4 — the five-stage background pipeline, every AI call (`trigger/`)
- Vercel AI SDK + AI Gateway — one pipeline model, embeddings for the vault
- Parallel Task API — company research (ultra) and peer research (base, escalating to ultra)
- Cloudflare Turnstile on `/login` via Supabase captcha protection
- `@react-pdf/renderer` — the proposal PDF

Not wired yet: Stripe Checkout (packages are shown, not sold). See [AGENTS.md](AGENTS.md) for the layout; pipeline contract in [context/product/pipeline-rules.md](context/product/pipeline-rules.md).

## Run

```bash
pnpm install
cp .env.example .env.local   # fill from the Supabase project
pnpm dev        # http://localhost:3000
pnpm build      # production build
pnpm lint
```

## Deploy

Production (since 2026-08-27, T-032):

- **Web**: Vercel project `sme24-ai` — https://sme24-ai.vercel.app, functions in `fra1` (`vercel.json`), git-connected: every merge to `main` deploys production. Env (production): the Supabase URL + publishable + secret keys, the **prod** `TRIGGER_SECRET_KEY`, and the Turnstile **test** site key (real keys are a launch item).
- **Pipeline**: Trigger.dev **prod** environment of project `sme24-ehs` — `npx trigger.dev@latest deploy --env-file .env.local` from the repo. The `syncEnvVars` extension in `trigger.config.ts` pushes everything the tasks read (Supabase URL + secret key, `PARALLEL_API_KEY`, `AI_GATEWAY_API_KEY`) from the deployer's env file on every deploy.
- **Auth**: Supabase site URL is the production domain; the redirect allowlist holds `https://sme24-ai.vercel.app/auth/**` and keeps `http://localhost:3000/auth/**` for the dev stack.
- Dev stack unchanged: `pnpm dev` + `npx trigger.dev@latest dev` against the same Supabase project.

Still launch-gated (tickets.md Later): verified Resend sender domain (the dev sender only delivers internally), real Turnstile keys, custom domain.

## Working on this repo

Read [AGENTS.md](AGENTS.md) first — it defines the ticket-driven workflow, the `context/` doc system, and the code standards.
