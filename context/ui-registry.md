# UI registry

Every reusable component, one line each: `ComponentName (path) — what it's for, key props/slots`. Match before inventing; update this file whenever a component is added, changed, or removed.

## Primitives (`components/ui/`)

- `Card` (components/ui/card.tsx) — shadcn card; slots `CardHeader`, `CardTitle`, `CardDescription`, `CardAction`, `CardContent`, `CardFooter`.
- `Field` (components/ui/field.tsx) — shadcn form field layout; `Field` (`orientation` vertical|horizontal|responsive), `FieldGroup`, `FieldSet`, `FieldLegend`, `FieldLabel`, `FieldContent`, `FieldTitle`, `FieldDescription`, `FieldError` (`errors[]` or children), `FieldSeparator`.
- `Input` (components/ui/input.tsx) — shadcn text input; native props, `aria-invalid` styles the error state.
- `Label` (components/ui/label.tsx) — shadcn label; used via `FieldLabel`.
- `Separator` (components/ui/separator.tsx) — shadcn separator (pulled in by Field); `orientation`.
- `Button` (components/ui/button.tsx) — shadcn button; `variant` default|outline|secondary|ghost|destructive|link, `size` default|xs|sm|lg|icon|icon-xs|icon-sm|icon-lg, `asChild` to render a Link. `buttonVariants` exported for link-as-button.

## Composites

- `LoginCard` (components/portal/LoginCard.tsx, client) — the single sign-in card: Google button, separator, magic-link email form; `next` (validated path forwarded to both doors), `error` (human copy rendered as an alert). Swaps itself for a "Check your email" state after a successful send (`useActionState` on `requestMagicLink`).
- `MagicLinkConfirm` (components/portal/MagicLinkConfirm.tsx, server) — "Almost there" card whose single button POSTs the token to `confirmMagicLink`; `tokenHash`, `next`. The token is spent on POST only, so a prefetched GET cannot consume it.
- `AuthNav` (components/marketing/AuthNav.tsx, async server) — header auth controls: a Sign in link when signed out, email + Log out form (calls `actions/auth#logout`) when signed in. Rendered inside `SiteHeader`'s nav.
- `SiteShell` (components/marketing/SiteShell.tsx) — root page frame: SkipLink + SiteHeader + `<main id="main">` + SiteFooter; `children` fill main. Used by `app/layout.tsx`.
- `SiteHeader` (components/marketing/SiteHeader.tsx) — top bar with brand link (ShieldCheck + "SME24") and a primary `<nav>` holding `AuthNav`; no props.
- `SiteFooter` (components/marketing/SiteFooter.tsx) — copyright + tagline; no props.
- `SkipLink` (components/a11y/SkipLink.tsx) — visually hidden "Skip to content" link to `#main`, visible on focus.

## Pages of note

- `/login` (app/(auth)/login/) — `LoginCard`, centered by `app/(auth)/layout.tsx`; reads `next` and `error` from the query string.
- `/auth/confirm` (app/(auth)/auth/confirm/) — `MagicLinkConfirm`, same centered layout; noindex. Missing token → `/login?error=link_expired`.
- `/design` (app/design/page.tsx) — design-system reference: every token pair, lines, chart ramp, radius, type scale, Button variants × sizes. Unlinked; noindex. Update it whenever a token or Button variant changes.
