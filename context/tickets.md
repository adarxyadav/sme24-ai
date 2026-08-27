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

(empty — next up: repo owner picks from Later)

## Next

(empty)

## Later

Deferred scope — not tickets yet; each becomes one, with its check, when it moves up.

- Packages: fill `context/product/packages.md`, then Stripe Checkout with MWST and the retainer contact form.
- Post-report collection surface for the leading indicators and the client-only lagging four.
- Deploy target.
- Auth before launch: Resend verified EU domain + `noreply@<domain>` sender (SMTP itself is already live on the dev sender), production redirect-URL allowlist, custom auth domain decision, DE/FR email templates, account deletion + email change (`auth.md` Not in v1).
