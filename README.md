# SME24

AI-powered EHS (environment, health & safety) consulting marketplace for the Swiss market.

A client enters their company name and a background pipeline does the rest: researches public disclosures, extracts safety KPIs, benchmarks them against industry peers, estimates the annual cost of incidents in CHF, and matches senior EHS experts — all delivered free in the client dashboard.

The free report is the funnel; revenue comes from four fixed-price consulting packages — three sold via Stripe Checkout with Swiss MWST, one retainer via contact form. Tier definitions live in [context/product/packages.md](context/product/packages.md).

Three user roles share the app — **clients**, **experts**, and **admins** — each with their own surface.

## Stack

- Next.js 16 (App Router) + React 19, TypeScript strict
- Tailwind CSS 4
- pnpm

Planned, not wired yet: Supabase (Postgres, Storage, RLS), Trigger.dev (background pipeline, all AI calls), Stripe Checkout. See [AGENTS.md](AGENTS.md) for the target layout.

## Run

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm build      # production build
pnpm lint
```

## Deploy

Not set up yet — this section fills in when the first deploy target lands.

## Working on this repo

Read [AGENTS.md](AGENTS.md) first — it defines the ticket-driven workflow, the `context/` doc system, and the code standards.
