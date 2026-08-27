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

- Display-time derivations from `kpi-contract.md` (recordable / lost-time counts from rate × hours, hours from headcount) — the ledger shows stored rows only (`t-006-spec.md` D4); needs the ≈ + formula rendering rule designed first.
- Packages: fill `context/product/packages.md`, then Stripe Checkout with MWST and the retainer contact form.
- Post-report collection surface for the leading indicators and the client-only lagging four.
- Stage 3 retry re-buys the peer call: the judge model call runs in the same task attempt as the paid Parallel peer call, so a model failure after the result (seen 2026-08-22 on `1572cc64`: two base peer runs for one attempt pair, under the Gateway free-tier rate limit) costs a second Parallel call on retry — the class T-005 D1 avoided for stage 1. Fix: persist the gathered peers (the raw comparison, `parallel_run_id`) before the judge and reuse them on attempt > 1 of the same run. Found in T-021.
- Cancelled-run terminal status: `onCancel` currently writes `failed` because the state machine has no `cancelled`. Decide whether a distinct status is worth a schema change.
- Deploy target.
- Auth before launch: Resend verified EU domain + `noreply@<domain>` sender (SMTP itself is already live on the dev sender), Turnstile on `/login`, production redirect-URL allowlist, custom auth domain decision, DE/FR email templates, account deletion + email change (`auth.md` Not in v1).
