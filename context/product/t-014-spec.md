# T-014 spec — Live run progress on the run page

Decided 2026-08-22 before any code. This file records what was decided; it
does not reopen it. The acceptance criteria are the ticket's Check, quoted
verbatim below — nothing here restates or reinterprets it.

## Acceptance criteria

From `context/tickets.md`, T-014, verbatim:

> - What: `/dashboard/runs/[id]` updates itself while a run is `queued` or in progress — a client component polls by calling `router.refresh()` on an interval, so the Server Component re-reads through `lib/portal/` and the page moves to the completed/no-data/delayed block with the ledger without a reload. The dashboard learns nothing from the engine: no Trigger.dev import, no `trigger_run_id`, no new route. The "refresh this page" copy goes.
> - Check: with the page open in a scripted browser (no reload — a `window` marker set before the run starts is still present at the end), a Nestlé `nestle.ch` cache-hit run posted for the same user moves from Queued/In progress to Completed with the KPI ledger rendered; a terminal run's HTML (curl) carries no poller; the rendered HTML and the dashboard's client bundle contain no `trigger_run_id` and no `@trigger.dev`; the `no-restricted-imports` boundary still passes; `npx tsc --noEmit`, `pnpm lint`, `pnpm build` green.

## Standing facts this spec assumes

- The run page is a Server Component reading `getRunById` through the
  read layer; the read layer selects no `trigger_run_id` or `error`
  (`t-006-spec.md` D1/D3). `runState` maps nine statuses to five states.
- `router.refresh()` (Next 16, `use-router.md`): "Making a new request to the
  server, re-fetching data requests, and re-rendering Server Components. The
  client will merge the updated React Server Component payload without losing
  unaffected client-side React … or browser state." The page is dynamic
  (cookies), so nothing is cached server-side.
- The dashboard's ESLint boundary already forbids `@trigger.dev/*` and
  every engine module in `components/dashboard/**`.

## Decisions

### D1 — Polling is `router.refresh()`, not a JSON endpoint and not realtime

One client component, `RunProgress`, mounted by the page only while the state
is `queued` or `in_progress`, calls `router.refresh()` every 5 s. The Server
Component re-runs `getRunById` — the same read-layer query, RLS-scoped — and
the RSC payload is merged in place. When the row turns terminal the page
renders the ledger and stops mounting the poller, so a terminal page carries
no timer.

Why not a `/api/runs/[id]/status` route: it would be a second read path
outside `lib/portal/` for the same row, and the page would then hold a client
copy of state the server already renders. Why not Trigger.dev realtime
(`trigger-realtime-and-frontend`): it subscribes by Trigger.dev run id, which
the dashboard is forbidden to know (`tickets.md` Later: "a realtime hook would
couple the dashboard to the engine's run ids"); polling meets the Check with
no such coupling, so realtime is out.

5 s: one RLS-scoped single-row select per tick per open page; a cache-hit run
completes in ~25 s and a miss in 10–20 min, so the user sees the change
within seconds of the row moving, at negligible load.

### D2 — Copy

"Refresh this page in a minute" is replaced by "This usually takes a few
minutes"; the poller renders a one-line "This page updates automatically."
with `aria-live="polite"` so the state change is announced.

## Verification record

2026-08-22, dev environment, `pnpm dev` + the dev worker
(`PIPELINE_MODEL=openai/gpt-5-mini`). Scripted Chromium (Playwright) with
user A's minted cookies.

1. **No-reload progression.** Run `eb1b8c69` (Nestlé `nestle.ch`, cache
   hit — no Parallel call) posted, page opened at `Queued` (08:00:35),
   `window.__t014 = "marker"` set; observed `In progress` at 08:00:41 and
   `Completed` at 08:00:51 with the "KPI ledger" heading rendered; the
   marker still read `"marker"` at the end, so the document was never
   reloaded; the poller line was gone from the completed page; the DOM
   contained no `trigger_run_id` / `@trigger.dev`.
2. **Terminal HTML.** `curl` of the completed run's page with the owner's
   cookie: 0 hits for "updates automatically", 1 for "KPI ledger", 0 for
   `trigger_run_id` / `@trigger`.
3. **Client bundle.** After `pnpm build`, `grep -rl 'trigger_run_id\|@trigger.dev'
   .next/static` → 0 files; the poller's chunk is present (1 file).
4. `pnpm lint` (boundary rule included), `npx tsc --noEmit`, `pnpm build` —
   green.

## Files

New: `components/dashboard/RunProgress.tsx`, this spec. Changed:
`app/dashboard/runs/[id]/page.tsx`, `components/dashboard/RunStatusCard.tsx`
(copy), `context/ui-registry.md`, `context/architecture.md`,
`context/tickets.md`, `context/log.md`.
