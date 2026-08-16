# Domain glossary

One entry per domain term: `**Term** — definition as used in this product.` Add a term the first time it appears in a ticket or doc; every doc and identifier uses these terms, no synonyms.

- **Client** — a company (via its representative) that requests a free EHS report and may buy a package. One of the three user roles.
- **Expert** — a senior EHS consultant matched to clients and delivering package work. One of the three user roles.
- **Admin** — internal operator overseeing clients, experts, and pipeline output. One of the three user roles.
- **Report** — the free deliverable in the client dashboard: extracted safety KPIs, peer benchmark, incident cost estimate (CHF), and expert matches. The funnel into paid packages.
- **Pipeline** — the background AI process that builds a report from a company name: research public disclosures → extract KPIs → benchmark against industry peers → estimate incident cost → match experts. Contract in `context/product/pipeline-rules.md`.
- **Package** — a fixed-price consulting offering. Four exist: three sold via Stripe Checkout with Swiss MWST, one retainer via contact form. Source of truth: `context/product/packages.md`.
- **Surface** — the part of the app serving one role (client, expert, admin), plus marketing.
- **MWST** — Swiss VAT (Mehrwertsteuer), applied to Stripe Checkout sales.
