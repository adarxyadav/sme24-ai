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

- Pipeline stages 3–5: peer benchmarking, expert matchmaking, proposal generation + EHS Vault.
- Annual incident cost (CHF) in the read layer, once the loss constants have their source doc in `context/product/`.
- Display-time derivations from `kpi-contract.md` (recordable / lost-time counts from rate × hours, hours from headcount) — the ledger shows stored rows only (`t-006-spec.md` D4); needs the ≈ + formula rendering rule designed first.
- Live run progress on the dashboard (polling or Trigger.dev realtime) — T-006 tells the user to refresh; a realtime hook would couple the dashboard to the engine's run ids, so it needs its own boundary decision.
- Packages: fill `context/product/packages.md`, then Stripe Checkout with MWST and the retainer contact form.
- Expert and admin surfaces.
- Post-report collection surface for the leading indicators and the client-only lagging four.
- Base-processor escalation paths.
- Uploaded report override (stage 1 step 4, scoped out of T-004 — `t-004-spec.md` D10): private Storage bucket, upload control on the search form, `uploaded_report_path` validated as owned by the caller in the trigger route, and a Claude PDF read that overrides the web result for any field it covers. *Check to be written by the repo owner before this moves up.*
- Stalled in-progress runs: T-010 gave `queued` an owner, but `researching` (and every later working status) still has none. `onCancel` catches a cancelled or crashed task; a worker that dies without cancelling leaves the run in-progress forever, which is how `91c61651` sat at `researching` for two hours on 2026-08-21. The `queued` sweeper's approach does not transfer — a run legitimately occupies `researching` for up to the task's 30-minute `maxDuration`, and the row alone cannot say whether the task is still alive, so this needs `runs.retrieve` against the Trigger.dev API rather than an age threshold. *Check to be written by the repo owner before this moves up.*
- Cancelled-run terminal status: `onCancel` currently writes `failed` because the state machine has no `cancelled`. Decide whether a distinct status is worth a schema change.
- Marketing site beyond the search form.
- Deploy target.
- Auth before launch: Resend verified EU domain + `noreply@<domain>` sender (SMTP itself is already live on the dev sender), Turnstile on `/login`, production redirect-URL allowlist, custom auth domain decision, DE/FR email templates, account deletion + email change (`auth.md` Not in v1).
