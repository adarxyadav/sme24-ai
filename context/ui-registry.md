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
- `Textarea` (components/ui/textarea.tsx) — shadcn textarea; native props.
- `Checkbox` (components/ui/checkbox.tsx, client) — shadcn/Radix checkbox; with `name`/`value` it submits as a form field. Used via `FieldLabel` pairs.
- `RadioGroup` (components/ui/radio-group.tsx, client) — shadcn/Radix radio group; `RadioGroup` (`name`, `defaultValue`) + `RadioGroupItem` (`value`).
- `Button` (components/ui/button.tsx) — shadcn button; `variant` default|outline|secondary|ghost|destructive|link, `size` default|xs|sm|lg|icon|icon-xs|icon-sm|icon-lg, `asChild` to render a Link. `buttonVariants` exported for link-as-button.
- `Sidebar` (components/ui/sidebar.tsx, client) — shadcn sidebar family: `SidebarProvider` (cookie-persisted state, sheet below `md`), `Sidebar` (offcanvas collapsible), `SidebarHeader`/`SidebarContent`/`SidebarFooter`, `SidebarGroup` + `SidebarGroupContent`, `SidebarMenu`/`SidebarMenuItem`/`SidebarMenuButton` (`isActive`, `asChild`), `SidebarInset` (renders `<main>`), `SidebarTrigger` (sr-only label); styled by the `sidebar-*` tokens.
- `Sheet` (components/ui/sheet.tsx, client) — shadcn/Radix sheet dialog; pulled in as the Sidebar's mobile mode. `side` top|right|bottom|left.
- `Skeleton` (components/ui/skeleton.tsx) — shadcn loading placeholder; pulled in with Sidebar, unused elsewhere yet.
- `Tooltip` (components/ui/tooltip.tsx, client) — shadcn/Radix tooltip (`Tooltip`, `TooltipTrigger`, `TooltipContent`, `TooltipProvider` — not self-providing); pulled in with Sidebar, used only by `SidebarMenuButton`'s `tooltip` prop (icon-collapse mode, which we don't run).

## Composites

- `LoginCard` (components/portal/LoginCard.tsx, client) — the single sign-in card: Google button, separator, magic-link email form with a Turnstile widget (token as hidden field, submit disabled until it passes); `next` (validated path forwarded to both doors), `error` (human copy rendered as an alert). Swaps itself for a "Check your email" state after a successful send (`useActionState` on `requestMagicLink`).
- `MagicLinkConfirm` (components/portal/MagicLinkConfirm.tsx, server) — "Almost there" card whose single button POSTs the token to `confirmMagicLink`; `tokenHash`, `next`. The token is spent on POST only, so a prefetched GET cannot consume it.
- `BrandMark` (components/marketing/BrandMark.tsx, server) — the SME24 logo lockup (mark + wordmark) as inline SVG with token fills (`fill-foreground`/`fill-background`), so it follows the theme; `className` for sizing; `aria-hidden` — the consumer provides the accessible name.
- `AuthNav` (components/marketing/AuthNav.tsx, async server) — header auth controls: a Log in link when signed out; "For experts"/"Expert area" link (by role), email + Log out form (calls `actions/auth#logout`) when signed in. Rendered inside `SiteHeader`.
- `HowItWorks` (components/marketing/HowItWorks.tsx, server) — "How it works": the five pipeline stages as a numbered grid; no props.
- `Features` (components/marketing/Features.tsx, server) — "What you get": five Card tiles naming the report's parts; no props.
- `PackagesSection` (components/marketing/PackagesSection.tsx, server) — "Packages": the four tiers from `lib/packages/tiers.ts` as Cards (price excl. MWST or "On request", format/scope/output/outcome), one CTA, the tier-3 scope note; `ctaHref`, `ctaLabel`.
- `ExpertsCta` (components/marketing/ExpertsCta.tsx, server) — "For experts" strip linking `/expert/apply`; no props.
- `SiteShell` (components/marketing/SiteShell.tsx) — page frame for every non-dashboard surface: SkipLink + SiteHeader + `<main id="main">` + SiteFooter; `children` fill main. Used by `app/(site)/layout.tsx`.
- `ThemeProvider` (components/marketing/ThemeProvider.tsx, client) — next-themes provider in the root layout: class-based dark mode, light default, system optional; `children`.
- `ThemeToggle` (components/marketing/ThemeToggle.tsx, client) — light / dark / system segmented control (icon Buttons with `aria-pressed`, mounted guard); rendered in `SiteFooter`; no props.
- `SiteHeader` (components/marketing/SiteHeader.tsx) — top bar inside `AutoHideHeader`: brand link (`BrandMark`, `aria-label` on the link) left, centered primary `<nav>` (How it works / Expert network / Packages anchors, hidden below `md` — the footer nav is the mobile path), `AuthNav` right; no props.
- `AutoHideHeader` (components/marketing/AutoHideHeader.tsx, client) — sticky `<header>` that hides on scroll down and reappears on scroll up (always shown near the top, revealed by keyboard focus, `motion-reduce` drops the transition); `children` fill it, so server content passes through.
- `SiteFooter` (components/marketing/SiteFooter.tsx) — copyright + tagline, a footer nav (How it works, Packages, Expert network, Log in) and the `ThemeToggle`; no props.
- `SkipLink` (components/a11y/SkipLink.tsx) — visually hidden "Skip to content" link to `#main`, visible on focus.
- `SearchForm` (components/portal/SearchForm.tsx, client) — the run intake: company name (required), optional website, optional safety-report PDF (uploaded first to `/api/uploads`, the returned path sent as `uploadedReportPath`), reporting period, and the canonical 7 KPI fields. POSTs JSON to `/api/runs` and navigates to the returned run. Blank KPI fields are omitted from `kpis[]`, never sent as empty strings. No props.
- `ExpertProfileForm` (components/expert/ExpertProfileForm.tsx, client) — the expert application/edit form: name, headline, bio, years, checkbox groups from `lib/experts/catalogue` (competencies, sectors, languages, regions), availability radio; `useActionState` on `actions/expert#saveExpertProfile`, refreshes on save; `expert` (row or null), `submitLabel`.
- `ExpertMatchesList` (components/expert/ExpertMatchesList.tsx, server) — the expert's client matches: company, rank, date table or "No matches yet"; `matches` (from `lib/experts/read#getOwnMatches`).
- `ExpertStatusCard` (components/expert/ExpertStatusCard.tsx, server) — fixed copy per application status; `status` (pending|approved|rejected).
- `DashboardShell` (components/dashboard/DashboardShell.tsx, server) — the dashboard's own chrome (T-033), replacing `SiteShell` on `/dashboard`: `SidebarProvider` + `SkipLink`, sidebar (brand link, `DashboardNav`, footer with `ThemeToggle` + email + Log out form), `SidebarInset` as `main#main` with a slim `SidebarTrigger` top bar and a `max-w-5xl` content column; `email`, `role`, `children`.
- `DashboardNav` (components/dashboard/DashboardNav.tsx, client) — the sidebar menu: New search (`/dashboard`, exact-match active), Your analyses (`/dashboard/runs`, prefix active so run details count), plus Expert area (`/expert`) for role expert or Admin (`/admin`) for role admin; closes the mobile sheet on click; `role`.
- `RunStatusCard` (components/dashboard/RunStatusCard.tsx, server) — a run's company name, domain, `RunStatusBadge` and one of five state blocks (queued, in progress, completed, nothing public found, delayed) keyed on `lib/portal/run-state`; `run`. The failed block is fixed copy — it reads nothing but the status.
- `RunProgress` (components/dashboard/RunProgress.tsx, client) — polls the run page while a run is queued or in progress: `router.refresh()` every 5 s re-renders the Server Component through the read layer; renders a one-line "updates automatically" note. Mounted by the run page only for live states; no props.
- `RunStatusBadge` (components/dashboard/RunStatusBadge.tsx, server) — the run state's label as an outline Badge with its token; `status`. Shared by `RunList` and `RunStatusCard`.
- `RunList` (components/dashboard/RunList.tsx, server) — table of the caller's runs (company + domain, status badge, started), each linking to its detail page; `runs`. Renders its own empty prompt with a New search link.
- `IncidentCostCard` (components/dashboard/IncidentCostCard.tsx, server) — the annual incident cost: CHF range title, Category/Count/Cost rows, notes (derived counts used with their formulas, lost-time unknown, unpriced counts, per-incident rates); `cost` (from `lib/portal/incident-cost#buildIncidentCost`, null renders "Cannot be estimated"). Completed runs only.
- `BenchmarkCard` (components/dashboard/BenchmarkCard.tsx, server) — stage 3 on the report: "Rank n of N on TRIR" title (or no-comparable / insufficient copy), maturity outline Badge ("Emerging" for the bottom rung), verdict + rationale block, references `dl`, peer table with per-peer basis and "not ranked" marks; `benchmark` (from `lib/portal/benchmark#getRunBenchmark`). Completed runs with a row only.
- `ExpertMatchesCard` (components/dashboard/ExpertMatchesCard.tsx, server) — stage 4 on the report: up to three matched experts as ranked articles (name, headline, availability badge, rationale, competency badges, languages/regions/years) or the "No expert matched yet" copy; `matches` (from `lib/portal/matches#getRunMatches`, labels pre-resolved).
- `ProposalCard` (components/dashboard/ProposalCard.tsx, server) — stage 5 on the report: title, executive summary, "Download PDF" (60 s signed URL), recommended package box (tier, price excl. MWST, rationale), key risks, EHS Vault sources used or the "drafted without reference material" note; `proposal` (from `lib/portal/proposal#getRunProposal`).
- `KpiLedger` (components/dashboard/KpiLedger.tsx, server) — the report table: metric + hint, value + unit (or ≈ derived value + formula line per design.md Derived figures, or Not disclosed), period, confidence badge (`derived` outline for derived rows), source link + excerpt, "Uploaded report" + excerpt, "Client-provided", or "Derived from <inputs>"; `rows` (from `lib/portal/ledger#buildLedger`).

- `AdminNav` (components/admin/AdminNav.tsx, server) — section links for the admin surface (Overview, Runs, Users, Experts); no props.
- `AdminRunTable` (components/admin/AdminRunTable.tsx, server) — every run with owner email, `RunStatusBadge`, tier, started; `runs`, `emails` (Map user id → email).
- `AgentLogTable` (components/admin/AgentLogTable.tsx, server) — a run's `agent_logs` in order: time, stage, level badge, message, raw payload; `logs`.
- `ExpertDecisionForm` (components/admin/ExpertDecisionForm.tsx, client) — Approve / Reject buttons for one application (`useActionState` on `actions/admin#setExpertStatus`), or the settled status; `userId`, `status`.

## Pages of note

- Chrome split (T-033): `app/(site)/layout.tsx` wraps the marketing, auth, expert, admin and design routes in `SiteShell`; the root layout carries only fonts + `ThemeProvider`; `/dashboard` renders in `DashboardShell` instead.
- `/login` (app/(site)/(auth)/login/) — `LoginCard`, centered by `app/(site)/(auth)/layout.tsx`; reads `next` and `error` from the query string.
- `/auth/confirm` (app/(site)/(auth)/auth/confirm/) — `MagicLinkConfirm`, same centered layout; noindex. Missing token → `/login?error=link_expired`.
- `/` (app/(site)/page.tsx) — the marketing page: hero with one CTA (signed in → `/dashboard`, signed out → the login door with `next=/dashboard`; no `SearchForm`, T-034), then `HowItWorks`, `Features`, `PackagesSection`, `ExpertsCta`; own metadata title + description.
- `/dashboard` (app/dashboard/page.tsx) — the dashboard default: `SearchForm` as the new-search page; `app/dashboard/layout.tsx` reads `getUser` and mounts `DashboardShell`, `app/dashboard/not-found.tsx` is the not-found state in app chrome. noindex.
- `/dashboard/runs` (app/dashboard/runs/page.tsx) — `RunList` of the caller's runs plus a New search link to `/dashboard`. noindex.
- `/dashboard/runs/[id]` (app/dashboard/runs/[id]/) — `RunStatusCard` for a run the caller owns, `RunProgress` while it is queued or in progress, plus `KpiLedger`, `IncidentCostCard`, `BenchmarkCard`, `ProposalCard` and `ExpertMatchesCard` (the last three when a benchmark row exists) when the run is completed; another user's run is not-found. noindex.
- `/expert/apply` (app/(site)/expert/apply/) — the application page: form for `expert_status = none`, `ExpertStatusCard` for pending/rejected; experts are redirected to `/expert`. noindex.
- `/expert` (app/(site)/expert/page.tsx) — the expert surface (role `expert` only, others → `/expert/apply`): approved card, `ExpertMatchesList`, `ExpertProfileForm` prefilled. `app/(site)/expert/layout.tsx` is the container. noindex.
- `/admin` … `/admin/runs`, `/admin/runs/[id]`, `/admin/users`, `/admin/experts` (app/(site)/admin/) — the admin surface, `requireAdmin()` on every page (non-admins → `/auth/redirect`); `app/(site)/admin/layout.tsx` holds `AdminNav`. noindex.
- `/design` (app/(site)/design/page.tsx) — design-system reference: every token pair, lines, chart ramp, radius, type scale, Button variants × sizes. Unlinked; noindex. Update it whenever a token or Button variant changes.
