# Auth rules

The authentication contract: ways in, session, roles, gating, and the data boundary. Auth code follows this file. Rationale lives in the Decision log at the bottom — the sections above it are pure rules.

**Supabase proves identity, RLS guards data, proxy guards pages.** Three layers, each with one job. Nothing in app code decides "who is this" on its own.

## Cast

| Concern | Tool |
|---|---|
| Users, sessions, identities | Supabase Auth (EU project) |
| Magic-link delivery | Resend as Supabase custom SMTP, from day one — Supabase only unlocks email-template editing once custom SMTP is set, and the token-hash flow needs an edited template. Dev sender `onboarding@resend.dev` (delivers only to the Resend account's own address); verified EU domain sender before launch |
| OAuth | Google, via Supabase provider |
| Session transport | `@supabase/ssr` HTTP-only cookies; `proxy.ts` refreshes |
| Roles | `public.profiles` (`client` \| `expert` \| `admin`), created by DB trigger, locked against self-edit |

## Ways in

Two doors on `/login`, no passwords anywhere:

- **Magic link** — `signInWithOtp({ email, options: { emailRedirectTo: <origin>/auth/confirm?next=… } })`. UI shows "Check your email". Existing and new users share this path; there is no separate signup screen.
- **Google** — `signInWithOAuth({ provider: 'google', options: { redirectTo: <origin>/auth/callback?next=… } })`.

Identities with the same verified email auto-link to one user (Supabase default). A Google-first user may later use a magic link and vice versa.

## Coming back

- **Magic link → `/auth/confirm`** (page, not a route handler). The email template sends `{{ .TokenHash }}` and `type=email`, never `{{ .ConfirmationURL }}`. The page renders a single "Continue to SME24" button; the POST (Server Action) calls `verifyOtp({ token_hash, type: 'email' })`, which sets the session cookies, then redirects to `next` or `/auth/redirect`. Reason: link scanners prefetch GETs and would consume the token; token-hash exchange also works when the email is opened on a different device or browser.
- **Google → `/auth/callback`** (route handler). `exchangeCodeForSession(code)` → cookies → redirect to `next` or `/auth/redirect`.
- **Failure** (expired, used, tampered) → `/login?error=link_expired` (or `oauth_failed`); the login page maps the code to human copy and offers to resend. Nothing from Supabase's error text reaches the UI.
- **`next` validation** — accepted only if it is a relative path: starts with exactly one `/`, no `//`, no `\`, no scheme. Anything else → `/auth/redirect`. Checked in one helper (`lib/auth/safe-next.ts`) used by both returns and by the proxy.

## Profiles and roles

- `public.profiles` — `id uuid pk references auth.users on delete cascade`, `role` (`client` default), `expert_status` (`none` \| `pending` \| `approved` \| `rejected`, default `none`), `created_at`, `updated_at`.
- Trigger `handle_new_user` on `auth.users` insert creates the row. `security definer`, `set search_path = ''`, owned by `postgres`.
- Same migration locks it: `authenticated` may `select` own row only; no `insert`/`delete`; `update` limited to non-privileged columns via column-level grant — `role` and `expert_status` change only through the service role (admin surface, Later).
- A missing profile is a bug, not a state: the read helper logs it and returns "not signed in" semantics; it never fabricates a client profile.
- Expert surface and expert RLS grants key on `role = 'expert'`, which is set by an admin on approval. `expert_status = 'pending'` routes a client to `/expert/apply` status view, never to the expert surface.
- Applying is `apply_as_expert(jsonb)` — a `security definer` function keyed on `auth.uid()` that upserts the caller's `experts` row and moves `expert_status` `none -> pending` in one transaction. It is the only write path to `experts` for a user and the only non-service-role write to `profiles`; `approved`/`rejected` it never touches (t-017-spec.md D1).

## Landing

`/auth/redirect` (route handler) reads the profile and dispatches: `admin` → `/admin`, `expert` → `/expert`, `client` with `expert_status = 'pending'` → `/expert/apply`, else → `/dashboard`.

## Every request

`proxy.ts` → `lib/supabase/proxy.ts`:

- Refreshes the session with `getClaims()` (local JWT verification, no Auth round-trip). `getUser()` is reserved for moments that need live truth (payment, role change).
- No session + protected path (`/dashboard`, `/expert`, `/admin`, `/expert/apply`) → `/login?next=<path>`.
- Session + `/login` → `/auth/redirect`.
- `/auth/*` is never redirected by the proxy. Static assets are excluded by the matcher.
- The proxy never reads `profiles`. Role checks happen in the page or Server Action via `lib/auth/get-user.ts` → `{ user, profile }`.

## Data boundary

- RLS on every table keys on `auth.uid()` from the cookie session; the proxy decides pages, RLS decides rows (`architecture.md` Auth/RLS lists the policies).
- Service-role client (`lib/supabase/admin.ts`) exists only for `trigger/`, `app/api/webhooks/`, and admin-only Server Actions that must change `profiles.role`. Never imported by a page or a client-role action.
- An expert reads the runs that matched them through `my_expert_matches()` (`security definer`, company name + rank only); experts never hold a select on `analysis_runs` (t-018-spec.md D3).
- Admin reads are RLS policies on `is_admin()`; the one admin write (`setExpertStatus`, approve/reject) is a Server Action on the service role after `getUser()` says `admin`. The admin role is set by SQL (t-022-spec.md).
- Logout: `signOut({ scope: 'local' })` — this device only.

## Dashboard configuration (not in code)

Recorded here because it cannot be versioned:

- Email provider: Resend custom SMTP (`smtp.resend.com:465`, user `resend`, API key as password), sender `onboarding@resend.dev` during build-out — Resend delivers that sender only to the account's own address (`service@ichotz.com`); every other recipient gets a 550 and Supabase answers 500 "Error sending magic link email". Before launch: verified EU domain, sender `noreply@<domain>`, SPF + DKIM. Flipping the sender changes no code.
- Email templates: **both** "Magic link or OTP" and "Confirm sign up" (Supabase sends the latter for a brand-new email) link to `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email`; copy in English for now (DE/FR: Later).
- Redirect URLs allowlist: `http://localhost:3000/auth/**` and the production origin.
- Rate limits: OTP sends ≤ 1 per email per 60 s (Supabase default) — keep.
- Captcha protection: **on**, provider Turnstile (T-024). The secret lives in Supabase Auth only (set through the management API); the site key is `NEXT_PUBLIC_TURNSTILE_SITE_KEY`. Cloudflare's public test pair during build-out; swap both for the real pair at launch — no code change. Applies to the magic-link (OTP) flow; Google OAuth is not captcha-gated by Supabase.
- Sessions: refresh-token rotation on, reuse interval default; inactivity timeout **30 days** (decided; change here first).
- Google provider: client ID/secret from Google Cloud project `sme24` (OAuth client `sme24-supabase`, redirect URI `https://<ref>.supabase.co/auth/v1/callback`); consent screen published (email/profile scopes need no verification) and shows the Supabase domain until the custom-domain add-on is bought (launch decision).

## Not in v1

Account deletion path (FADP/GDPR — cascades already handled by FK), email change, DE/FR templates, custom auth domain. All under Later in `tickets.md`.

## Decision log

- **Resend from day one, not at launch** (2026-08-20) — planned as built-in SMTP during build-out; Supabase locks template editing behind custom SMTP, and the token-hash link only exists in an edited template, so the launch vendor moved forward. No code impact.
- **One mail vendor** (2026-08-20) — Resend carries auth mail too, not a second SMTP: one domain, one DKIM, one suppression list; Supabase's built-in sender is rate-limited and unbranded, so it is dev-only.
- **Passwordless, two doors** (2026-08-20) — rejected: email + password. SMEs lose passwords, support cost is real, and magic link + Google cover every Swiss SME inbox. The password flow built for T-002 is deleted by T-009, no compat layer.
- **Token-hash + confirm button instead of `?code=` link** (2026-08-20) — rejected: PKCE `code` in the email. Fails cross-device and is consumed by Outlook Safe Links; a one-click confirm page costs the user nothing.
- **Roles in `profiles`, locked in the same migration** (2026-08-20) — rejected: role in user metadata (user-editable) and a later lock migration (self-promotion window). JWT claim via access-token hook is a later optimisation once a role check lands in the proxy.
- **`getClaims()` not `getUser()` per request** (2026-08-20) — one Auth round-trip per navigation to Frankfurt is latency with no security gain for page gating.
- **`expert_status` separate from `role`** (2026-08-20) — rejected: routing on "applied". Grants must key on approval, not intent.
