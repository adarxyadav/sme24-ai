# UI registry

Every reusable component, one line each: `ComponentName (path) — what it's for, key props/slots`. Match before inventing; update this file whenever a component is added, changed, or removed.

## Primitives (`components/ui/`)

- `Card` (components/ui/card.tsx) — shadcn card; slots `CardHeader`, `CardTitle`, `CardDescription`, `CardAction`, `CardContent`, `CardFooter`.
- `Field` (components/ui/field.tsx) — shadcn form field layout; `Field` (`orientation` vertical|horizontal|responsive), `FieldGroup`, `FieldSet`, `FieldLegend`, `FieldLabel`, `FieldContent`, `FieldTitle`, `FieldDescription`, `FieldError` (`errors[]` or children), `FieldSeparator`.
- `Input` (components/ui/input.tsx) — shadcn text input; native props, `aria-invalid` styles the error state.
- `Label` (components/ui/label.tsx) — shadcn label; used via `FieldLabel`.
- `Separator` (components/ui/separator.tsx) — shadcn separator (pulled in by Field); `orientation`.
- `Table` (components/ui/table.tsx) — shadcn table; slots `TableHeader`, `TableBody`, `TableFooter`, `TableRow`, `TableHead`, `TableCell`, `TableCaption`; scrolls horizontally inside its own wrapper.
- `Badge` (components/ui/badge.tsx) — shadcn badge; `variant` default|secondary|destructive|outline|ghost|link, `asChild`. Status/confidence colour is a semantic text class on `outline`, never a new variant.
- `Button` (components/ui/button.tsx) — shadcn button; `variant` default|outline|secondary|ghost|destructive|link, `size` default|xs|sm|lg|icon|icon-xs|icon-sm|icon-lg, `asChild` to render a Link. `buttonVariants` exported for link-as-button.

## Composites

- `LoginCard` (components/portal/LoginCard.tsx, client) — the single sign-in card: Google button, separator, magic-link email form; `next` (validated path forwarded to both doors), `error` (human copy rendered as an alert). Swaps itself for a "Check your email" state after a successful send (`useActionState` on `requestMagicLink`).
- `MagicLinkConfirm` (components/portal/MagicLinkConfirm.tsx, server) — "Almost there" card whose single button POSTs the token to `confirmMagicLink`; `tokenHash`, `next`. The token is spent on POST only, so a prefetched GET cannot consume it.
- `AuthNav` (components/marketing/AuthNav.tsx, async server) — header auth controls: a Sign in link when signed out, email + Log out form (calls `actions/auth#logout`) when signed in. Rendered inside `SiteHeader`'s nav.
- `SiteShell` (components/marketing/SiteShell.tsx) — root page frame: SkipLink + SiteHeader + `<main id="main">` + SiteFooter; `children` fill main. Used by `app/layout.tsx`.
- `SiteHeader` (components/marketing/SiteHeader.tsx) — top bar with brand link (ShieldCheck + "SME24") and a primary `<nav>` holding `AuthNav`; no props.
- `SiteFooter` (components/marketing/SiteFooter.tsx) — copyright + tagline; no props.
- `SkipLink` (components/a11y/SkipLink.tsx) — visually hidden "Skip to content" link to `#main`, visible on focus.
- `SearchForm` (components/portal/SearchForm.tsx, client) — the run intake: company name (required), optional website, reporting period, and the canonical 7 KPI fields. POSTs JSON to `/api/runs` and navigates to the returned run. Blank KPI fields are omitted from `kpis[]`, never sent as empty strings. No props.
- `RunStatusCard` (components/dashboard/RunStatusCard.tsx, server) — a run's company name, domain, `RunStatusBadge` and one of five state blocks (queued, in progress, completed, nothing public found, delayed) keyed on `lib/portal/run-state`; `run`. The failed block is fixed copy — it reads nothing but the status.
- `RunProgress` (components/dashboard/RunProgress.tsx, client) — polls the run page while a run is queued or in progress: `router.refresh()` every 5 s re-renders the Server Component through the read layer; renders a one-line "updates automatically" note. Mounted by the run page only for live states; no props.
- `RunStatusBadge` (components/dashboard/RunStatusBadge.tsx, server) — the run state's label as an outline Badge with its token; `status`. Shared by `RunList` and `RunStatusCard`.
- `RunList` (components/dashboard/RunList.tsx, server) — table of the caller's runs (company + domain, status badge, started), each linking to its detail page; `runs`. Renders its own empty prompt with a New search link.
- `IncidentCostCard` (components/dashboard/IncidentCostCard.tsx, server) — the annual incident cost: CHF range title, Category/Count/Cost rows, notes (lost-time unknown, unpriced counts, per-incident rates); `cost` (from `lib/portal/incident-cost#buildIncidentCost`, null renders "Cannot be estimated"). Completed runs only.
- `KpiLedger` (components/dashboard/KpiLedger.tsx, server) — the report table: metric + hint, value + unit (or Not disclosed), period, confidence badge, source link + excerpt or "Client-provided"; `rows` (from `lib/portal/ledger#buildLedger`).

## Pages of note

- `/login` (app/(auth)/login/) — `LoginCard`, centered by `app/(auth)/layout.tsx`; reads `next` and `error` from the query string.
- `/auth/confirm` (app/(auth)/auth/confirm/) — `MagicLinkConfirm`, same centered layout; noindex. Missing token → `/login?error=link_expired`.
- `/` (app/page.tsx) — hero plus `SearchForm` for a signed-in visitor, or a sign-in link when signed out (the trigger route requires a session).
- `/dashboard` (app/dashboard/page.tsx) — `RunList` of the caller's runs plus a New search link; `app/dashboard/layout.tsx` is the shared container and `app/dashboard/not-found.tsx` the not-found state in app chrome. noindex.
- `/dashboard/runs/[id]` (app/dashboard/runs/[id]/) — `RunStatusCard` for a run the caller owns, `RunProgress` while it is queued or in progress, plus `KpiLedger` and `IncidentCostCard` when the run is completed; another user's run is not-found. noindex.
- `/design` (app/design/page.tsx) — design-system reference: every token pair, lines, chart ramp, radius, type scale, Button variants × sizes. Unlinked; noindex. Update it whenever a token or Button variant changes.
