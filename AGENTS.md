<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md

## Read first

`context/` holds the file kinds every project repeats; `context/product/` holds docs that exist only because of this product.

- `README.md` — product, stack, run, deploy
- `context/architecture.md` — surfaces, pipeline, data, auth/RLS
- `context/design.md` — tokens, typography, dashboard composition rules
- `context/ui-registry.md` — the component registry; match before inventing
- `context/product/pipeline-rules.md` — the AI pipeline contract
- `context/tickets.md` — the work queue; what you build comes from here
- `context/log.md` — one-line history; read the recent lines

Reference: `context/product/auth.md` (the auth contract), `context/product/kpi-contract.md` (which KPIs we ask vs. show), `context/product/packages.md` (tier source of truth), `context/library-docs.md` (per-library project rules), `CONTEXT.md` (domain glossary).

## Rules that never change

- No ticket, no work — build only what's in `context/tickets.md`. Every ticket names its check before work starts; the doer never edits what counts as done. New asks land under Later first — moving one up is an explicit trade.
- After every change: one line in `context/log.md` (date — what — why, `deviated:` if it diverged from the ticket) and update `ui-registry.md` when a component is added, changed, or removed. Done tickets get a log line and leave `tickets.md`. When a change moves a rule or scope, update the owning context file.
- Before any third-party library: read its section in `context/library-docs.md` for project-specific rules. (When library skills get installed, load the library's skill first, then the doc.)
- If the same problem persists after one corrective prompt — stop and ask the user before trying again.
- Never use hardcoded hex values or raw Tailwind color classes — only semantic token classes. Raw values live in `app/globals.css` alone.
- When talking: terse over grammatically complete.

## Coding behavior

- Think first. Surface assumptions before coding. If multiple interpretations exist, name them — don't pick silently. If something is unclear, stop and ask.
- Surgical changes. Touch only what the task requires. Don't improve adjacent code, reformat, or refactor things that aren't broken. Match existing style. Remove only imports/variables YOUR changes made unused.
- Define success. Before multi-step tasks, state a brief plan with a verifiable check per step.
- Lego blocks. Components form a library pages are assembled from: minimize entropy in the API surface, combine components into bigger blocks, use render-prop slots to enforce layouts.

## Engineering principles

- Do not preserve backward compatibility. Remove obsolete paths instead of adding compatibility layers, fallbacks, or migrations.
- Choose the simplest implementation that fully meets the current requirements. Avoid speculative abstractions, configuration, and indirection.
- Grow the system in layers. Start from the smallest version that works end to end, and add each new capability on top of a product that already works. Never trade a working product for unfinished complexity.
- Keep components modular and concerns clearly separated.
- Lean on the dependencies already in the project first; when new functionality is needed, prefer an established, well-maintained library over reimplementing it. Do not assume a library lacks a capability without checking its documentation and types.
- Make architectural decisions for the long term. Do not accept a stopgap that only works for now and is meant to be replaced later.

## Code standards

- TypeScript. Strict mode. No `any` — use `unknown` and narrow. Type assertions only when necessary, with a comment why. `const` by default. No floating promises.
- Next.js 16. App Router only; React 19. Server Components by default — `"use client"` only for state, effects, browser APIs, event listeners, or client-only libraries. Data fetching in Server Components. Route handlers in `app/api/` validate input + auth before any logic; Server Actions live in `actions/`, never inline. Uncached by default — dynamic code runs at request time.
- Styling. Colors per the token rule above; token definitions and composition rules in `context/design.md`. Radius scale: small controls `rounded-sm`, panels `rounded-lg`/`rounded-xl` per registry. Lucide icons; icon-only buttons need an accessible label.
- Comments. Only for why — a non-obvious decision or constraint. Never narrate what the code does. No TODO comments in committed code.
- Errors. No empty catch blocks. User-facing errors are human-readable — never raw internals. Pipeline errors go to `agent_logs`, never the UI. API errors return generic messages with stable status codes.
- Naming/layout. Folders kebab-case, components PascalCase (one per file), utilities camelCase. `components/ui/` = app-owned shadcn primitives; `components/{marketing,portal,dashboard,admin,expert,a11y}/` by surface; `lib/` shared infra; `trigger/` background tasks (all AI calls); `supabase/migrations/` schema DDL + RLS (source of truth for data shape). Directories not present yet are target state — create each when its first file lands.
- Data. Metadata in Postgres; binary artifacts in Supabase Storage with the path written to the owning row; protected files served via signed URLs only.

## Agent skills

### Issue tracker

`context/tickets.md` is the only queue — no GitHub Issues, no `.scratch/`. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: `CONTEXT.md` plus the `context/` tree. No ADR directory. See `docs/agents/domain.md`.

## Before handoff

- `npx tsc --noEmit`, `pnpm lint`, `pnpm build` — all green.
