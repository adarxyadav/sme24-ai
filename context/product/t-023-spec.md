# T-023 spec — Marketing site beyond the search form

Decided 2026-08-22 before any code. This file records what was decided; it
does not reopen it. The acceptance criteria are the ticket's Check, quoted
verbatim below — nothing here restates or reinterprets it.

## Acceptance criteria

From `context/tickets.md`, T-023, verbatim:

> - What: `/` becomes the marketing page: hero (signed in → `SearchForm`; signed out → sign-in door), "How it works" (the five pipeline stages in plain words), "What you get" (KPI ledger with sources, annual incident cost in CHF, peer benchmark, matched experts, proposal PDF), "Packages" (the four tiers from `lib/packages/tiers.ts` with prices excl. MWST, tier 4 on request, the tier-3 scope note from `packages.md` Open; no checkout yet — the CTA is the free report), "For experts" strip linking `/expert/apply`; header gains a Packages anchor link, footer gains the section links. Server components in `components/marketing/`, `design.md` tokens and type scale only, `/design` as the reference. Page metadata title + description.
> - Check: (1) `/` fetched signed out carries the headings "How it works", "What you get", "Packages", "For experts", four tier cards reading CHF 2'000 / CHF 5'000 / CHF 10'000 / "On request", the pending-scope note, and a sign-in CTA; fetched with a session it renders the `SearchForm` above the sections; (2) scripted Chromium at 390 px wide: `document.documentElement.scrollWidth <= clientWidth` (no horizontal scroll) and every section heading present; at 1280 px the hero and the first section are in the viewport; (3) `grep` finds no hex and no raw Tailwind colour class in `components/marketing/` and `app/page.tsx`; (4) `npx tsc --noEmit`, `pnpm lint`, `pnpm build` green; `ui-registry.md` updated.

## Standing facts this spec assumes

- `/` held the hero and the signed-in `SearchForm` only (T-003). The tiers
  exist in code (`lib/packages/tiers.ts`, T-019) with `packages.md`'s Open
  questions carried; Stripe Checkout and the tier-4 contact form are item
  14, blocked on the owner.
- `design.md`: cream canvas, one teal accent, weights capped at 500, the
  type scale on `/design` ("Marketing hero", "Section title", "Label").

## Decisions

### D1 — One page, five sections, all server

No new routes: anchors (`#how-it-works`, `#what-you-get`, `#packages`,
`#for-experts`) on `/`, linked from the header (Packages) and the footer.
Each section is one server component in `components/marketing/` with its
copy as a literal array; no client state anywhere. The "Label" type role
(`text-xs font-medium tracking-wide uppercase text-muted-foreground`)
introduces each section, the hero keeps the existing "Marketing hero" role.

### D2 — Packages without checkout

`PackagesSection` renders the four tiers from `TIERS` (`formatChf` for
prices, "On request" for tier 4) and one CTA — the free report (the form
when signed in, the sign-in door otherwise). The tier-3 scope caveat from
`packages.md` is stated under the cards rather than hidden, so the page
does not promise wording the owner has not confirmed. When item 14 lands,
the CTA per tier becomes Checkout / the contact form; the section's shape
is already that of a pricing table.

### D3 — Copy claims only what ships

"How it works" names the five stages as the engine runs them; "What you
get" names the five cards the dashboard renders. Nothing on the page
describes a feature that is not live on the dev stack today.

## Verification record

2026-08-22, dev environment.

1. `curl /` signed out: "How it works" ×4 (heading + nav/footer), "What
   you get" ×2, "Packages" ×6, "For experts" ×4, "CHF 2’000" / "CHF
   5’000" / "CHF 10’000" / "On request" each present, the tier-3 note
   ("exact scope wording") present, "Sign in to run a search" ×4, no
   `companyName` input; `<title>` and `description` set. With user A's
   cookie: `companyName` input present (the form above the sections).
2. Chromium 390 px: `scrollWidth 390 / clientWidth 390`, 4 `h2`s, hero in
   viewport; 1280 px: `1280 / 1280`, hero in viewport, first section top
   at 577 px of an 844 px viewport. Screenshots `home-390.png` (full page)
   and `home-1280.png` inspected.
3. `grep` for hex and raw colour classes over `components/marketing/` and
   `app/page.tsx` → 0 hits.
4. `npx tsc --noEmit`, `pnpm lint`, `pnpm build` green; registry updated.

## Files

New: `components/marketing/{HowItWorks,Features,PackagesSection,ExpertsCta}.tsx`,
this spec. Changed: `app/page.tsx`, `components/marketing/{SiteHeader,SiteFooter}.tsx`,
context docs.
