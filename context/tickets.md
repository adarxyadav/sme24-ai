# Tickets

The work queue. No ticket, no work. Every ticket names its check before work starts; the doer never edits what counts as done. New asks land under Later first — moving one up is an explicit trade.

Ticket format:

```
### T-001 — Short title
- What: one or two sentences of scope
- Check: the verifiable condition that counts as done
```

First feature (T-001 → T-006): the funnel spine — company name in, extracted KPIs with provenance out. Pipeline stages 1+2 only, signup gated before the run. T-001 and T-002 are independent; everything else is serial.

## Now

### T-032 — Deploy: Vercel production + Trigger.dev prod
- What: merge the PR stack (#5→#21) into main in order; create the Vercel project (owner `adarxyadav`, EU functions region, production = main via the GitHub connection, env: Supabase URL + publishable key + secret key, prod `TRIGGER_SECRET_KEY`, Turnstile test site key until launch); deploy `trigger/` tasks to the Trigger.dev prod environment with its env (Supabase URL + secret key, AI Gateway, Parallel); Supabase auth site URL + redirect allowlist gain the production domain; README Deploy section filled. Owner ruling 2026-08-27: full deploy, real credits accepted.
- Check: the production URL serves the marketing page; a magic-link request for the deliverable dev address reaches "Check your email"; a signed-in production run on a cache donor completes end to end (stage-1 cache hit; the one uncacheable base peer call accepted); PRs #5→#21 all show merged; README Deploy describes the setup.

## Next

(empty)

## Later

Deferred scope — not tickets yet; each becomes one, with its check, when it moves up.

- Packages: fill `context/product/packages.md`, then Stripe Checkout with MWST and the retainer contact form.
- Post-report collection surface for the leading indicators and the client-only lagging four.
- Deploy target.
- Auth before launch: Resend verified EU domain + `noreply@<domain>` sender (SMTP itself is already live on the dev sender), production redirect-URL allowlist, custom auth domain decision, DE/FR email templates, account deletion + email change (`auth.md` Not in v1).
