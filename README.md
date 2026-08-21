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

Planned, not wired yet: Supabase Storage + pgvector, Trigger.dev (background pipeline, all AI calls), Vercel AI SDK + AI Gateway, Parallel Task API (web research), Stripe Checkout. See [AGENTS.md](AGENTS.md) for the target layout; pipeline contract in [context/product/pipeline-rules.md](context/product/pipeline-rules.md).

## Run

```bash
pnpm install
cp .env.example .env.local   # fill from the Supabase project
pnpm dev        # http://localhost:3000
pnpm build      # production build
pnpm lint
```

## Deploy

Not set up yet — this section fills in when the first deploy target lands.

## Working on this repo

Read [AGENTS.md](AGENTS.md) first — it defines the ticket-driven workflow, the `context/` doc system, and the code standards.
