# T-024 spec — Turnstile on /login

Decided 2026-08-22 before any code. This file records what was decided; it
does not reopen it. The acceptance criteria are the ticket's Check, quoted
verbatim below — nothing here restates or reinterprets it.

## Acceptance criteria

From `context/tickets.md`, T-024, verbatim:

> - What: Supabase Auth captcha protection switched on for the project (provider Turnstile; secret set through the management API, never in the repo), `LoginCard` renders a Cloudflare Turnstile widget (`@marsidev/react-turnstile`, site key from `NEXT_PUBLIC_TURNSTILE_SITE_KEY`) whose token rides the magic-link form as a hidden field, and `requestMagicLink` passes it as `options.captchaToken`. Cloudflare's public test keys during build-out; real keys are an env swap (`auth.md`, "enable Turnstile on /login before launch"). Google OAuth is unaffected (Supabase applies captcha to OTP/password flows).
> - Check: (1) the project's auth config reads `security_captcha_enabled = true`, `security_captcha_provider = turnstile`; a server-side `signInWithOtp` without `captchaToken` is refused by Supabase (error mentions captcha), so the gate is Supabase's, not ours; (2) `/login` HTML carries the Turnstile container and the site key from env; in scripted Chromium the widget passes (test key) and submitting an email reaches the "Check your email" state; (3) submitting with the token field blanked shows the human copy, never Supabase's text; (4) `npx tsc --noEmit`, `pnpm lint`, `pnpm build` green; `.env.example`, `auth.md` (Dashboard configuration), `library-docs.md`, `ui-registry.md` updated.

## Standing facts this spec assumes

- Supabase Auth verifies captcha tokens itself when captcha protection is
  on; the client passes `options.captchaToken`. The project had it off
  (`security_captcha_enabled: false`, provider hcaptcha by default).
- The dev Resend sender delivers only to the Resend account's own address.

## Decisions

### D1 — Supabase is the verifier; the secret never touches the repo

Captcha protection is turned on through the management API
(`security_captcha_enabled`, `security_captcha_provider: turnstile`,
`security_captcha_secret`) — dashboard configuration that cannot be
versioned, recorded in `auth.md`. The action forwards the token and maps
`captcha_failed` to human copy; it does not call siteverify itself, so
there is no second secret and no second verdict.

### D2 — Widget and token

`@marsidev/react-turnstile` (the library the docs point at; script
injection and SSR handled) renders in the magic-link form with
`size: "flexible"`; `onSuccess` stores the token in a hidden `captchaToken`
field and the submit button stays disabled until one exists. A missing
token is also refused server-side ("Please complete the verification and
try again.") so a hand-built POST cannot skip the widget. Google OAuth is
untouched: Supabase does not gate `signInWithOAuth` on captcha.

### D3 — Test keys until launch

Cloudflare's public pair (`1x00000000000000000000AA` /
`1x0000000000000000000000000000000AA`) always passes, so the dev project
keeps working for everyone; the real pair is an env + management-API swap.

## Verification record

2026-08-22, dev environment.

1. Management API after the PATCH: `security_captcha_enabled: true`,
   `security_captcha_provider: turnstile`. Anon-client `signInWithOtp`
   without a token → `captcha_failed` "captcha protection: request
   disallowed (no captcha_token found)".
2. `/login` HTML carries the Turnstile container; the site key is inlined
   in the client bundle (a `NEXT_PUBLIC_` value — fetched from the page's
   scripts and found), not in the server HTML. Chromium: the test widget
   produced `XXXX.DUMMY.TOKEN…`; submitting `service@ichotz.com` → action
   state `{"sent":true}`, card title "Check your email". Two earlier
   submissions to other addresses returned the generic send error: the
   auth log shows Resend's 550 "You can only send testing emails to your
   own email address (service@ichotz.com)" — the dev-sender restriction,
   not the captcha (the token was accepted in the same request). Recorded
   in `auth.md`.
3. Token field blanked via script, submit forced → alert "Please complete
   the verification and try again."; no Supabase text.
4. `npx tsc --noEmit`, `pnpm lint`, `pnpm build` green; docs updated.

## Files

New: this spec. Changed: `components/portal/LoginCard.tsx`,
`actions/auth.ts`, `.env.example`, `package.json`
(`@marsidev/react-turnstile`), context docs.
