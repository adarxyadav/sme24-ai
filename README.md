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

Not set up yet — the dev stack (`pnpm dev` + `npx trigger.dev@latest dev`) is the only running environment. This section fills in when the deploy ticket lands (Vercel EU + Trigger.dev prod).

## Working on this repo

Read [AGENTS.md](AGENTS.md) first — it defines the ticket-driven workflow, the `context/` doc system, and the code standards.
