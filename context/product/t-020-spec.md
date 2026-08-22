# T-020 spec — Uploaded report override (stage 1 step 4)

Decided 2026-08-22 before any code. This file records what was decided; it
does not reopen it. The acceptance criteria are the ticket's Check, quoted
verbatim below — nothing here restates or reinterprets it. It supersedes the
deferral in `t-004-spec.md` D10.

## Acceptance criteria

From `context/tickets.md`, T-020, verbatim:

> - What: private bucket `uploads` (PDF only, 20 MB, no client read policy); `POST /api/uploads` (session-authenticated multipart, PDF magic bytes checked, stored by the service role at `<user_id>/<uuid>.pdf`, returns the path); the search form gains an optional "Your latest safety report (PDF)" control that uploads first and sends `uploadedReportPath` with the run; the trigger route accepts the field only when its first folder is the caller's id and the object exists. Stage 1 step 4 (`pipeline-rules.md`): when the row carries a path, the PDF is read by the pipeline model through the Gateway (file part + `Output.object`, same finding shape as the web result, origin `upload`) and stored as `research.upload` — web findings stay in `research.output`, and a cache hit never copies a donor's `upload` block (client documents never leave the run). Stage 2 treats upload findings as overriding the web result for any metric they cover and writes those rows with `origin = 'upload'`; the ledger's Source column reads "Uploaded report". `no_data` is impossible for a run with an upload. Supersedes `t-004-spec.md` D10's deferral.
> - Check: (1) migration pushed: bucket `uploads` private, `anon`/`authenticated` cannot sign or list its objects; (2) `POST /api/uploads` → 401 signed out, 400 for a non-PDF body, 201 `{ path }` under `<A's id>/` for a PDF; `POST /api/runs` with a path under another user's folder or a missing object → 400, with A's own path → 201 and the row carries it; (3) a Nestlé `nestle.ch` cache-hit run by A with an uploaded test PDF stating TRIR 0.99, LTIFR 0.42 (both per 1'000'000 hours) and 311 near misses for 2025 ends `completed` with `kpis` rows TRIR 0.99 / LTIFR 0.42 / near_misses 311 at `origin = 'upload'` (web TRIR 1.13 overridden) and fatalities 2 at `origin = 'web'` untouched, `research.upload` present, and the ledger shows "Uploaded report" for the three rows; (4) the next Nestlé run by user B (cache hit on A's run) has no `research.upload` and its TRIR row is the web 1.13; (5) `npx tsc --noEmit`, `pnpm lint`, `pnpm build` green; `ui-registry.md` updated (`SearchForm`, `KpiLedger`).

## Standing facts this spec assumes

- `uploaded_report_path` existed on `analysis_runs`, never populated;
  stage 1 already evaluated `hasUpload` for the `no_data` predicate
  (`t-004-spec.md` D10). `create_analysis_run` did not take the path.
- The Gateway key accepts a PDF file part on `openai/gpt-5-mini` (tested
  before the ticket was written on the T-019 proposal PDF: three figures
  extracted with verbatim excerpts). Stage 2's prompt and `projectRows`
  assumed every finding is web (`origin: "web"` literal).
- The cache copied `research` wholesale (`lib/runs/research.ts`).

## Decisions

### D1 — Upload through a route, path owned by folder, validated twice

No browser Storage client (library-docs.md: none until something needs
one): the form posts the file to `POST /api/uploads`, which verifies the
session, checks the first bytes are `%PDF-` (the client's content type is
not trusted), and stores it through the service role at
`<user_id>/<uuid>.pdf`. The bucket has **no** client policy — not even the
owner can sign or list it; the document is read only by stage 1. The
trigger route then accepts `uploadedReportPath` only when it matches the
path shape, starts with the caller's id, and the object exists (a `list`
of that folder filtered by name). The path rides into `create_analysis_run`
(new last parameter; function dropped and recreated — one signature), so
the row and its inputs stay one write.

Rejected: a storage insert policy for `authenticated` on its own folder
(needs a browser client and a second place where "PDF only" is enforced);
trusting the path from the form without the existence check (a client
could point a run at a folder it does not own or at nothing).

### D2 — `research.upload`, never merged, never cached

The model's read of the PDF (`lib/upload/read.ts`: file part +
`Output.object`, finding shape = the web finding minus `source_url`) is
stored as `research.upload = { path, read_at, model, document_title,
findings, notes }` beside `research.output`, not inside it. A cache hit
copies the donor's research **without** `upload` — one client's document
must never surface in another client's report; the web part is all that
is shared. Stage 1 reads the PDF after the web result (a retry that already
has research still reads it) and logs `uploaded report read`.

### D3 — Stage 2 maps over one catalogue, upload first

`CatalogueFinding = EhsFinding & { origin }`. Stage 2 builds the catalogue
as upload findings (tagged `upload`, `source_url: null`) followed by web
findings (tagged `web`); the prompt states that an upload finding overrides
a web finding for any metric it covers; `projectRows` copies the origin
into the row. `replace_extracted_kpis` already deletes `origin <> 'client'`,
so upload rows are swapped with the web rows on a retry and client rows
still win. `lost_time_injuries` stays outside `WEB_EXTRACTABLE_METRICS` —
the contract's "research never fills this key" holds for the upload too.

### D4 — Ledger: "Uploaded report" + the excerpt

The Source cell for `origin = 'upload'` reads "Uploaded report" with the
verbatim excerpt; no link, since the object is private.

## Verification record

2026-08-22, dev environment, migration `20260822091008_create_uploads_bucket`
pushed; worker on `PIPELINE_MODEL=openai/gpt-5-mini`, no stage-3 seam: both
runs below were Nestlé cache hits for stage 1 (no Parallel ultra call) and
stage 3 ran its base peer call as designed — **two paid base calls**.

1. `getBucket('uploads').public === false`; user A `createSignedUrl` on
   A's own object → "Object not found", A `list(A's folder)` → `[]`;
   `anon` `createSignedUrl` → "Object not found".
2. `POST /api/uploads`: signed out → 401; `hello, not a pdf` with a PDF
   content type → 400 "The report must be a PDF."; the test PDF → 201
   `{ path: "9a17c844-…/fc135fb4-….pdf" }`. `POST /api/runs`: B with A's
   path → 400; A with a well-formed path to no object → 400; A with
   `../x.pdf` → 400; A with own path → 201 `3a63d903`, row
   `uploaded_report_path` = that path.
3. `3a63d903`: `cache hit` (donor `5aa05849`), `uploaded report read`
   (title "Nestlé S.A. — Safety performance report 2025 (test
   document)", 3 findings), `extraction started` with `findings: 43,
   upload_findings: 3`, mapped TRIR → the upload finding ("upload origin
   takes precedence"); rows: TRIR 0.99 `[upload]`, LTIFR 0.42 per
   1,000,000 hours worked `[upload]`, near_misses 311 `[upload]`,
   fatalities 2 `[web]`; `research.upload` present with the path and 3
   findings; ledger page: "Uploaded report" 6 hits (three rows × label +
   excerpt), excerpts verbatim from the PDF. Observed: the model put the
   scope ("employees and contractors combined") into the TRIR finding's
   `basis`; the value is right and the row says so, but the read prompt
   now says the basis is the denominator only and the scope has its own
   field.
4. `7900010f` (user B, right after): `cache hit` with donor `3a63d903`
   — A's upload run — `research.upload` absent, rows TRIR 1.13 `[web]`,
   fatalities 2 `[web]`.
5. `npx tsc --noEmit`, `pnpm lint`, `pnpm build` green; registry updated.

## Files

New: migration `create_uploads_bucket`, `app/api/uploads/route.ts`,
`lib/upload/{bucket,read}.ts`, this spec. Changed: `app/api/runs/route.ts`,
`trigger/company-research.ts`, `trigger/kpi-extraction.ts`,
`lib/extraction/extract.ts`, `lib/runs/research.ts`, `lib/runs/agent-log.ts`,
`components/portal/SearchForm.tsx`, `components/dashboard/KpiLedger.tsx`,
context docs.
