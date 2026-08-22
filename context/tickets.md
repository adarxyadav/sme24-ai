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
- Parallel run id is logged only after the result wait returns (`parallel run created` follows `researchCompany`), so a run killed mid-wait shows `cache miss` and nothing else while a paid ultra run exists. Log the id right after `createRun`, before the wait. Found 2026-08-22 during T-011 verification.
- Escalation re-run (`t-005-spec.md` D7, deferred) must write `trigger_run_id = ctx.run.id` on entry: it is exempt from the claim, and a row still pointing at the finished first run is what the T-011 sweeper terminates (`t-011-spec.md` D1).
- Cancelled-run terminal status: `onCancel` currently writes `failed` because the state machine has no `cancelled`. Decide whether a distinct status is worth a schema change.
- Marketing site beyond the search form.
- Deploy target.
- Auth before launch: Resend verified EU domain + `noreply@<domain>` sender (SMTP itself is already live on the dev sender), Turnstile on `/login`, production redirect-URL allowlist, custom auth domain decision, DE/FR email templates, account deletion + email change (`auth.md` Not in v1).
