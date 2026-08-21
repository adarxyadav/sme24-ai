# Domain glossary

One entry per domain term: `**Term** — definition as used in this product.` Add a term the first time it appears in a ticket or doc; every doc and identifier uses these terms, no synonyms.

- **Client** — a company (via its representative) that requests a free EHS report and may buy a package. One of the three user roles.
- **Expert** — a senior EHS consultant matched to clients and delivering package work. One of the three user roles.
- **Admin** — internal operator overseeing clients, experts, and pipeline output. One of the three user roles.
- **Report** — the free deliverable in the client dashboard: extracted safety KPIs, peer benchmark, incident cost estimate (CHF), expert matches, and a generated proposal PDF. The funnel into paid packages.
- **Pipeline** — the background AI process that builds a report from a company name: research public disclosures → extract KPIs → benchmark against peers → match experts → generate proposal. Incident cost is derived in code at display time, not by a pipeline stage. Contract in `context/product/pipeline-rules.md`.
- **Package** — a fixed-price consulting offering. Four exist: three sold via Stripe Checkout with Swiss MWST, one priced on request via contact form. Source of truth: `context/product/packages.md`.
- **Client KPIs** — optional structured values for the canonical metrics on the search form. Stored `origin: 'client'`; on conflict the client value wins and renders "Client-provided". Which KPIs are asked vs. shown: `context/product/kpi-contract.md`.
- **Lagging indicator** — a KPI measuring harm that already happened (TRIR, LTIFR, fatalities, near misses). The client doc has 10; these are what research can sometimes find publicly.
- **Leading indicator** — a KPI measuring the health of the safety management system itself (training completion, audit closure, permit compliance). The client doc has 28; all are internal data only the client can supply.
- **Annual incident cost** — the CHF figure shown on the report: the absolute cost of the incidents a company actually had, summed in code from fatality, recordable, and lost-time counts. Not a comparison against peers. Model in `context/product/kpi-contract.md`.
- **Provenance** — what every KPI row stores about where its value came from: `origin` (`web` | `upload` | `client`), source URL/excerpt, and confidence. Defined in `context/product/pipeline-rules.md`.
- **Proposal** — the consulting proposal PDF the pipeline's last stage generates, grounded by the EHS Vault; visible as soon as its run completes.
- **EHS Vault** — the pgvector document store of EHS reference material that grounds proposal generation.
- **Surface** — the part of the app serving one role (client, expert, admin), plus marketing.
- **MWST** — Swiss VAT (Mehrwertsteuer), applied to Stripe Checkout sales.
