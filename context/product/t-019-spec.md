# T-019 spec — Stage 5 proposal PDF, EHS Vault, private Storage

Decided 2026-08-22 before any code. This file records what was decided; it
does not reopen it. The acceptance criteria are the ticket's Check, quoted
verbatim below — nothing here restates or reinterprets it.

## Acceptance criteria

From `context/tickets.md`, T-019, verbatim:

> - What: `trigger/proposal-generation.ts`, chained after stage 4, moving `matching -> generating -> completed` (stage 4 hands back and no longer writes `completed`). EHS Vault: `ehs_documents` (pgvector, `extensions.vector(1536)`, service-role only — seeding is admin scope) + `match_ehs_documents()`; the query is embedded through the Gateway (`openai/text-embedding-3-small`, constant in `lib/vault/`). One Claude call (`Output.object`) drafts the proposal from research, KPIs, benchmark, matched experts, the retrieved vault passages and the tiers in `lib/packages/tiers.ts` (mirrors `packages.md`); an empty vault degrades to ungrounded drafting. `@react-pdf/renderer` renders it; the PDF is uploaded to the private bucket `proposals` at `<run_id>/proposal.pdf`; `proposals` row `{ run_id, content, pdf_path, sources }`. Dashboard: `ProposalCard` (title, summary, recommended package, vault sources used, download via a 60 s signed URL minted by the session client under a storage policy keyed on the run's owner). Contract: `pipeline-rules.md` Stage 5; AGENTS.md "binary artifacts in Storage, signed URLs only".
> - Check: (1) migration pushed: `vector` extension, `ehs_documents` + `match_ehs_documents`, `proposals`, bucket `proposals` with `public = false`, owner storage policy; `anon` and `authenticated` hold no privilege on `ehs_documents`, `anon` none on `proposals`; (2) with three reference documents seeded by service role, a Nestlé `nestle.ch` cache-hit run (stage 3 under `FORCE_STAGE3_EMPTY`, no Parallel call) ends `completed` via `matching -> generating`, its `proposals` row carries `content` (title, executive summary, a recommended tier that exists in `packages.md`, a roadmap) and `sources` naming ≥ 1 seeded document, and the object `<run_id>/proposal.pdf` exists in the bucket; (3) with the vault emptied, a run still ends `completed` with `sources = []`; (4) the run page renders `ProposalCard` with title, summary, recommended package and the vault sources, and its download link fetched with the owner's cookie returns a body starting with `%PDF` whose extracted text contains the company name; user B reads 0 `proposals` rows and cannot mint a signed URL for A's path; (5) `npx tsc --noEmit`, `pnpm lint`, `pnpm build` green; `library-docs.md` gains react-pdf, Storage and pgvector rules; `ui-registry.md` updated.

## Standing facts this spec assumes

- Stage 4 wrote `matching -> completed` (`t-018-spec.md` D1); children hand
  the handle back to the parent (`t-018-spec.md` D4).
- The Gateway key serves `openai/text-embedding-3-small` (1536 dims) — tested
  before the ticket was written, along with two alternatives; all three
  answered. `pgvector` is available on the EU project as the `vector`
  extension in the `extensions` schema.
- `packages.md` is the tier source of truth and carries four Open questions;
  the code mirror states them, it does not resolve them.
- No Storage bucket existed (the uploaded-report override, Later, is the
  next user of one).

## Decisions

### D1 — Stage 5 owns `completed`; stage 4 hands back

Same chain shape: stage 1 → `triggerAndWait` stage 5 after a successful
stage 4; stage 5 claims `matching|generating -> generating`, finishes
`generating -> completed`; stage 4's completion write moves here and stage
4 hands the handle back to the parent like stages 2 and 3.

### D2 — The vault: pgvector, one embedding model, service-role only

`ehs_documents(title, source, content, embedding vector(1536), metadata)`
with an HNSW cosine index and `match_ehs_documents(query_embedding,
match_count)` (cosine top-k, `1 - (<=>)` as similarity). No client grant at
all: the vault is our reference material; the proposal records what it
used. `lib/vault/embedding.ts` pins `openai/text-embedding-3-small` as a
constant, not an env var — the column's dimension is the model's, so a
change is a migration. Retrieval query = sector + the KPI rows in words +
the benchmark verdict; top 5. Seeding is admin scope (pipeline-rules.md);
three documents (ISO 45001 6.1.2, EKAS 6508, SUVA life-saving rules) were
seeded by a scratch script for this ticket and left in place.

### D3 — One model call, content as jsonb, numbers from rows

`lib/proposal/draft.ts`: system prompt with the Swiss frame (SUVA, EKAS,
Labour Act, ISO 45001), "use only the facts in the input", passages cited
by index. `proposalSchema` bounds the answer: title, executive summary,
3–6 situation bullets, 1–6 risks with why-it-matters, one `recommended_tier`
from `TIER_IDS`, rationale, 2–4 roadmap phases, an experts note, and
`passage_indices`. Code maps indices to the retrieved passages (unknown
index dropped) and stores them as `sources`. The tiers come from
`lib/packages/tiers.ts`, a code mirror of `packages.md` with its Open
questions carried verbatim; tier 4 has `priceChf: null` (on request).

### D4 — PDF in code with `@react-pdf/renderer`, Helvetica, one page flow

`lib/proposal/pdf.tsx` renders the stored content plus the KPI rows (from
the table, formatted `de-CH`) and the sources list, and returns a Buffer via
`renderToBuffer`. Built-in Helvetica avoids bundling font files into the
worker. The stylesheet uses literal colour values: a PDF has no CSS token
system, and AGENTS.md's token rule governs app styling — recorded here as
the deliberate exception, with the values taken from `design.md`'s ink and
stone. Footer states the provenance rule and that prices exclude MWST.

### D5 — Private bucket, owner policy, session-minted signed URL

Bucket `proposals` (`public = false`, 10 MB, PDF only) created in the
migration. The worker uploads through the service role to
`<run_id>/proposal.pdf` (`upsert: true`, so a retry overwrites). One
`storage.objects` select policy: the object's first folder is a run the
caller owns. The read layer (`lib/portal/proposal.ts`) mints a 60 s signed
URL through the **session** client, so the dashboard never holds a service
credential and a user who cannot read the row cannot sign the object
("Object not found"). The boundary rule permits `lib/supabase/server.ts`
only, which is exactly what this uses.

### D6 — Observed: the Gateway free tier rate-limits embeddings

The first seeded run's stage 5 threw on attempts 1 and 2 and succeeded on
attempt 3. Reproduced standalone: the third consecutive `embed()` call
returns "Free tier requests on this model are rate-limited". Trigger.dev's
≥ 60 s backoff (pipeline-rules.md) absorbed it, the run completed, and the
retry re-ran only the embed (nothing had been written). This is the same
key-tier limitation as `t-005-spec.md`'s deviation and belongs to the
deploy decision the owner has been asked for — not a code change.

## Verification record

2026-08-22, dev environment, migration
`20260822084755_create_vault_proposals_and_bucket` pushed first; worker
`FORCE_STAGE3_EMPTY=1 PIPELINE_MODEL=openai/gpt-5-mini` — no Parallel call.

1. `anon` on `ehs_documents` → permission denied; `authenticated` (user A)
   on `ehs_documents` → permission denied; `anon` on `proposals` →
   permission denied; `getBucket('proposals').public === false`.
2. Vault seeded with 3 documents. `483ebd2b` — handles: `… matching
   child → matching parent → generating child`; `proposal started` ×3
   (D6), `vault retrieved` 3 passages (EKAS 0.53, SUVA 0.44, ISO 45001),
   `proposal stored` `recommended_tier: transformation`, `sources: 3`,
   `pdf_bytes: 10671`, `completed` 08:58:08. Row: title "EHS proposal
   following free analysis — Nestlé S.A. (Switzerland)", 4 roadmap
   phases, `pdf_path = 483ebd2b…/proposal.pdf`; bucket lists
   `proposal.pdf 10671b application/pdf`.
3. Vault cleared → `5aa05849`: `vault retrieved` `[]`, `proposal stored`
   `sources: 0`, `completed` on attempt 1; row `sources = []`. Vault
   re-seeded afterwards.
4. Page (owner cookie): "Consulting proposal", the title, the summary,
   "Recommended package 3 — EHS Transformation Plan CHF 10'000 excl.
   MWST", key risks, three EHS Vault sources, "Download PDF". The signed
   link fetched → 200 `application/pdf`, 10671 bytes, body starts `%PDF-`;
   `pdftotext` output contains "Nestlé" (2 hits) with the executive
   summary, KPI rows and package box legible. User B: 0 `proposals` rows;
   `createSignedUrl` on A's path → "Object not found".
5. `npx tsc --noEmit`, `pnpm lint`, `pnpm build` green; `library-docs.md`
   and `ui-registry.md` updated.

## Files

New: migration `create_vault_proposals_and_bucket`,
`lib/packages/tiers.ts`, `lib/vault/{embedding,retrieve}.ts`,
`lib/proposal/{schema,draft}.ts`, `lib/proposal/pdf.tsx`,
`trigger/proposal-generation.ts`, `lib/portal/proposal.ts`,
`components/dashboard/ProposalCard.tsx`, this spec. Changed:
`trigger/company-research.ts`, `trigger/expert-matching.ts`,
`lib/runs/agent-log.ts`, `app/dashboard/runs/[id]/page.tsx`, `package.json`
(`@react-pdf/renderer`), context docs.
