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

(empty — next up: T-004)

## Next

### T-004 — Stage 1 company research
- What: Trigger.dev task — write client-KPI rows first, then cache-check by `cache_key` (copy `research` from the newest completed run under 30 days old), else call Parallel on ultra with the EHS output schema; uploaded PDF overrides any field it covers; `no_data` terminal.
- Check: a run for a known Swiss discloser stores `research` jsonb carrying findings, `basis[]` citations, per-field confidence, and `sector`; a second run for the same company reuses the cached research and makes no Parallel call, proven from `agent_logs`; a forced task failure sets `failed` plus the `error` column plus an `agent_logs` row while the UI shows only the generic notice; a company with no web data and no upload ends `no_data`.

### T-005 — Stage 2 KPI extraction
- What: Trigger.dev task normalizing stage-1 research into canonical `kpis` rows via `Output.object` + Zod, written as one atomic swap that touches only non-client rows. The run reaches `completed` after this stage until stages 3–5 land.
- Check: rows carry metric, value, unit, period, source_url, source_excerpt, confidence, and origin; client rows survive a forced retry unchanged and win every conflict; no metric outside the canonical list is ever written; the run ends `completed`.

### T-006 — Dashboard report read layer
- What: RLS-scoped read layer plus the client dashboard — run list and run detail rendering the KPI ledger with provenance, "Client-provided" markers, and a rendered state for every run status.
- Check: the dashboard reads only through the read layer, never the engine; queued, in-progress, completed, `no_data`, and `failed` each render a distinct state, with `failed` showing the generic delayed notice and no internals; client-origin rows render "Client-provided"; another user's run URL renders not-found; `ui-registry.md` lists every component added.

## Later

Deferred scope — not tickets yet; each becomes one, with its check, when it moves up.

- Pipeline stages 3–5: peer benchmarking, expert matchmaking, proposal generation + EHS Vault.
- Annual incident cost (CHF) in the read layer, once the loss constants have their source doc in `context/product/`.
- Packages: fill `context/product/packages.md`, then Stripe Checkout with MWST and the retainer contact form.
- Expert and admin surfaces.
- Post-report collection surface for the leading indicators and the client-only lagging four.
- Base-processor escalation paths.
- Marketing site beyond the search form.
- Deploy target.
- Auth before launch: Resend verified EU domain + `noreply@<domain>` sender (SMTP itself is already live on the dev sender), Turnstile on `/login`, production redirect-URL allowlist, custom auth domain decision, DE/FR email templates, account deletion + email change (`auth.md` Not in v1).
