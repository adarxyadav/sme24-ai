# Domain Docs

How the engineering skills should consume this repo's domain documentation.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root — the domain glossary.
- **`AGENTS.md`** — the rules that never change, plus the read-first list.
- The relevant file under **`context/`** for the area you're working in:
  `architecture.md` (surfaces, pipeline, data, auth/RLS), `design.md`
  (tokens, typography), `ui-registry.md` (the component registry),
  `product/pipeline-rules.md` (the AI pipeline contract),
  `product/kpi-contract.md` (the canonical metric list),
  `product/auth.md`, `product/packages.md`, `library-docs.md`.

## There is no ADR directory

This repo does not use `docs/adr/`. **Do not create one.**

Architectural decisions live in the context file that already owns the rule,
in that file's own Decision log where it has one:

| Decision about | Goes in |
| --- | --- |
| Pipeline stages, caching, run states | `context/product/pipeline-rules.md` |
| Metrics, what we ask vs. show | `context/product/kpi-contract.md` |
| Data shape, RLS, surfaces | `context/architecture.md` |
| A third-party library's project rules | `context/library-docs.md` |
| Tokens, typography, composition | `context/design.md` |
| Auth flows | `context/product/auth.md` |

Per AGENTS.md: "When a change moves a rule or scope, update the owning
context file."

## Use the glossary's vocabulary

When your output names a domain concept, use the term as defined in
`CONTEXT.md`. New domain terms are added to `CONTEXT.md`, matching its
existing format.

## Flag conflicts

If your output contradicts a rule in a context file, surface it explicitly
rather than silently overriding it.
