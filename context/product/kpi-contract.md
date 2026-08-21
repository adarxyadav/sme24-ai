# KPI contract

What we ask for before a run, what we show after, and what only the client can supply. This file owns the canonical metric list — the search form's optional fields, stage-2 extraction, and the trigger route's `kpis[]` validation all key on it (`pipeline-rules.md`).

**Source of truth:** the client's controlled document *EHS Management System KPIs / ISO 45004* — `context/product/EHS Management System_KPIs_ISO45004.docx`. It carries **38 indicators** in two families (10 lagging, 28 leading) plus a loss-cost table. Nothing outside this contract defines a metric.

## The three collection moments

Every indicator belongs to exactly one moment. The rule that decides: **ask up front only what changes a computed number** — the benchmark rank or the CHF loss. Everything else is friction on first touch.

1. **Ask** — the search form, all fields optional. The 7 below.
2. **Show** — the report's KPI ledger. The lagging set: `web` metrics always render, found or an honest "not disclosed"; `client` metrics render only when supplied. Client values are marked "Client-provided".
3. **Collect** — post-report, the rest of the taxonomy: the 28 leading indicators and the client-only lagging four. Internal management data no research can find. No surface in the first slice.

## Ask set — the canonical 7

Optional client fields on the search form; extraction fills whatever the client didn't supply, and the client value wins on conflict (`origin: 'client'`, `confidence: 'high'`). Each field earns its place by feeding a computed number.

| Field | Kind | Feeds |
| --- | --- | --- |
| TRIR | rate, per 1'000'000 hours worked | benchmark rank (primary); derives the recordable count |
| LTIFR | rate, per 1'000'000 hours worked | benchmark rank (fallback, same-base only); derives the lost-time count |
| Recordable injuries | count, past year | loss: × 25–50k |
| Lost-time injuries | count, past year | loss: + 5–15k on top of their recordable cost |
| Fatalities | count, past year | loss: × 1.0–1.2M |
| Near misses | count, past year | ledger + culture signal. No cost row — kept because the client highlighted both near-miss indicators |
| Hours worked | total hours, past year | the rate denominator; converts rates to counts |

**Reporting period** is a qualifier on all seven, not a metric of its own.

## Lagging indicators — the doc's 10, mapped

| Doc indicator | Key | Ask | Research | Feeds |
| --- | --- | --- | --- | --- |
| Total Recordable Incident Rate | `TRIR` | ✓ | web | benchmark rank (primary) |
| Lost Time Injury Frequency Rate | `LTIFR` | ✓ | web | benchmark rank (fallback) |
| Severity Rate | `severity_rate` | — | web | ledger display |
| Fatality Rate | `fatalities` | ✓ | web | loss: × 1.0–1.2M |
| Occupational Illness Rate | `occupational_illness_rate` | — | web | ledger display |
| Absenteeism Rate | `absenteeism_rate` | — | client-only | collect → ledger |
| Reportable Incident Rate | `reportable_incident_rate` | — | client-only | collect → ledger |
| Near-Miss Rate | `near_misses` | ✓ | web | ledger, culture signal |
| Property Damage Rate | `property_damage_rate` | — | client-only | collect → ledger |
| Enforcement Actions | `enforcement_actions` | — | web | ledger display |

We store the fatality **count**, not the doc's per-100'000-workers rate: the count is what the loss table prices, and the rate needs a headcount that research captures separately.

## Supporting metrics

Not doc rows — the arithmetic needs them:

| Key | Ask | Research | Why it exists |
| --- | --- | --- | --- |
| `total_recordable_injuries` | ✓ | web | the count behind TRIR; the loss model's recordable row |
| `lost_time_injuries` | ✓ | client-only | the count behind LTIFR. Web extraction folds lost-time data under LTIFR, so research never fills this key — absent a client figure it derives from LTIFR × hours |
| `hours_worked` | ✓ | web | rate denominator |

`headcount` is captured by research as company context, not stored as a KPI — it is not a safety metric.

## Leading indicators — the doc's 28

All **client-only**: internal management data, never publicly disclosed, never research-filled. Six groups, doc order:

- **Management system and governance (6)** — OH&S objectives achievement rate, management review completion rate, audit completion rate, audit finding closure rate, legal compliance rate, corrective action closure rate.
- **Hazard identification and risk management (5)** — hazard identification rate, risk assessment coverage, high-risk controls verified, change management compliance, permit-to-work compliance.
- **Training and competence (4)** — OH&S training completion rate, manager OH&S competency rate, induction completion rate, emergency response drill completion.
- **Worker participation and culture (5)** — worker participation rate, near-miss reporting rate, safety observation rate, OH&S culture survey score, leadership safety walk rate.
- **Health surveillance and wellbeing (5)** — health surveillance compliance rate, occupational health referral rate, fitness-for-work assessment completion, psychological health risk assessment coverage (links to ISO 45003), return-to-work success rate.
- **Inspection and maintenance (3)** — safety inspection completion rate, critical equipment maintenance compliance, PPE compliance rate.

Near-miss reporting rate (culture) is distinct from the lagging near-miss count: one measures worker reporting activity, the other counts events.

Empty leading groups stay quiet in the report — no assessment-scope scaffolding for data nobody supplied.

## Derivation rules

Computed in code, at display time, from stored rows:

| Output | Formula |
| --- | --- |
| Recordable injuries (count) | TRIR × hours ÷ 1'000'000 |
| Lost-time injuries (count) | LTIFR × hours ÷ 1'000'000 |
| Hours worked, when not disclosed | headcount × 1'880 |
| Peer rank / peer count | from the stored peer list; rank 1 = lowest rate = safest |
| Annual incident cost (CHF) | the loss model below |

- A disclosed count always beats a derived one.
- Derived figures render flagged with their formula and an ≈ on the value — computed context, never presented as a disclosure.
- Never convert a rate across metrics or bases: TRIR and LTIFR are not interconvertible, and a figure keeps the base it was disclosed on (`pipeline-rules.md`, comparability rules).
- TRIR and LTIFR are both per 1'000'000 hours worked here. A source disclosing on another base (e.g. the US per-100-workers convention) is stored with that base, excluded from count derivation, and excluded from the rank set — never converted.
- Severity rate and every leading indicator are not derivable — they are disclosed or absent.

## Shown, not asked

| KPI | Source |
| --- | --- |
| Peer rank / peer count | code, from the stored peer list |
| Industry references (median, best-in-class) | benchmark stage, same metric + base only |
| Maturity label | Claude judgment, Hudson scale ("Emerging" rendered for the bottom rung) |
| Annual incident cost (CHF) | code, loss model below, at display time |

## Loss model — absolute incident cost

The client's table prices the incidents a company actually had. It is **not** a gap-against-peers calculation.

The doc's table, per incident, built from working hours lost at roughly 75 CHF/h across seven components (employee hours, EHS manager time, area manager time, reduced output, order delays, rework/scrap, productivity drop):

| Doc row | Category | Cost |
| --- | --- | --- |
| Fatality | Death | CHF 1'200k |
| Lost-time incident — amputation | LTI | 88k |
| Lost-time incident — broken bone | LTI | 56k |
| Health-care incident — burn | HCI | 29k |
| Recordable incident — bruises, scratches | RCI | 15k |
| First-aid case — cuts | FA | 3k |

**How the counts map onto it.** Research gives us counts, never injury types, so each count takes the doc row its category matches. Rows in severity order — the waterfall:

1. fatalities × **1'200k** (flat)
2. lost-time injuries × **56k–88k** (the two LTI rows: broken bone → amputation)
3. remaining recordables, i.e. recordables − lost-time injuries, floored at zero × **15k** (the RCI row)

The total renders as a min–max range, driven by the lost-time row. No point estimate is invented.

**Rows we cannot fill.** The HCI-burn row (29k) needs an injury type no count carries — excluded until the open question below is settled. First-aid cases are neither asked nor priced.

**Never fabricate.** No count, no rate, or no hours → no row → a smaller honest total. When the lost-time count is unknown and cannot be derived, every recordable prices at the RCI row and the report says so — we never assume a severity mix. The ~75 CHF/h implied labour rate is context only, never used to invent a figure.

Cost constants live in code with the doc cited, next to the read layer that applies them.

## What deliberately stays off the form

- The 28 leading indicators — client-only, post-report. Twenty-eight fields on first touch kills the search moment.
- Severity rate, occupational illness rate, enforcement actions — research finds them when disclosed and a client can add them post-report; they change no computed number.
- The client-only lagging four (absenteeism, reportable incidents, property damage, and severity in practice).
- First-aid cases — see the loss model.
- Headcount — research captures it; not a safety KPI.

## Open

- **HCI-burn row.** Categorised HCI at 29k, below both LTI rows. Nothing in a count tells us an injury was a burn, so the row is unpriced today. Confirm it stays excluded, or give us a way to identify health-care incidents.
- **Client-only highlighted indicators.** Four highlighted lagging KPIs can only come from the client (absenteeism, reportable incidents, property damage, severity). Post-report collection is the plan — confirm that satisfies the highlighting.
- **Official all-accident statistics** (e.g. SUVA's per-1'000-FTE figures) are excluded from benchmarking as not TRIR-comparable, pending a client methodology call (`pipeline-rules.md`).

## Decision log

- **The canonical 7** (2026-08-20) — six originally (TRIR, LTIFR, recordable injuries, fatalities, near misses, hours worked), plus lost-time injuries so the loss model can price the lost-time increment from a real count. The rebuild's earlier five-metric list is superseded: it omitted the counts and the denominator, which made the CHF figure uncomputable.
- **Absolute incident cost, not a peer gap** (2026-08-20) — the rebuild's wording priced the difference against peers, which contradicts the client's own methodology. Corrected here and in `pipeline-rules.md`.
- **The doc's per-injury table is the loss model** (2026-08-20, user) — rejected: the later additive ranges (fatality 1.0–1.2M, recordable 25–50k, LTI +5–15k). The controlled doc in this repo is the cited source; the ranges lived only in a deck we are not carrying over.
- **TRIR is per 1'000'000 hours** (2026-08-20, user) — the doc's "per 100 workers per year" label is the US convention and does not describe our figures. Same base as LTIFR, so counts derive identically and either metric can carry the rank.
- **38 indicators, not 40** (2026-08-20) — the count quoted in the old product's prose was wrong; the doc has 10 lagging and 28 leading.
- **Fatality count, not fatality rate** (2026-07-16) — the count is what the loss table prices.
- **Rate × hours derivation** (2026-08-11) — a missing count derives from the disclosed rate, flagged with its formula; a disclosed count always wins.
- **Leading indicators stay post-report** (2026-07-16) — and empty leading groups stay quiet in the report.
