# T-017 spec — Expert data model + expert surface

Decided 2026-08-22 before any code. This file records what was decided; it
does not reopen it. The acceptance criteria are the ticket's Check, quoted
verbatim below — nothing here restates or reinterprets it.

## Acceptance criteria

From `context/tickets.md`, T-017, verbatim:

> - What: `experts` table (one row per user: name, headline, bio, competency tags from a fixed catalogue, NACE sections, languages, regions, years of experience, availability; owner-select RLS, no direct client writes) and `apply_as_expert(jsonb)` — a `security definer` function that validates the caller, upserts the caller's row and moves `profiles.expert_status` `none -> pending` in one transaction, so a client-role Server Action never touches the service role (`auth.md`). Surface: `/expert/apply` (application form for clients; "received" / "not accepted" status views) and `/expert` (approved experts: profile + the same form to edit; a placeholder for client matches until stage 4). Role gates in the pages via `get-user`; `AuthNav` links the expert area. Approval itself (`role = expert`, `expert_status = approved`) stays service-role only — the admin surface's job (Later); for this ticket it is done by SQL.
> - Check: (1) migration pushed via `supabase migration new` + `db push`; SQL proof: `anon` holds no privilege on `experts`, `authenticated` cannot insert/update `experts` or `profiles` directly, and `apply_as_expert` as user B creates B's row and sets B `pending` while leaving `role` `client`; (2) in a scripted browser, user B (client, `none`) submits `/expert/apply` with a name, headline, ≥ 1 competency and ≥ 1 language → the `experts` row carries those values, `/auth/redirect` lands B on `/expert/apply` showing "Application received", and `/expert` redirects B to `/expert/apply`; (3) an empty submission shows field errors and writes no row; (4) after SQL sets B `role = expert`, `expert_status = approved`, `/auth/redirect` lands B on `/expert` showing the profile and form; editing the headline there updates the row (`updated_at` moves) and leaves `expert_status` `approved`; (5) user A selecting B's `experts` row through the session client gets 0 rows; (6) `npx tsc --noEmit`, `pnpm lint`, `pnpm build` green, `ui-registry.md` updated.

## Standing facts this spec assumes

- `profiles` is locked: `authenticated` may only select its own row; `role`
  and `expert_status` change only through the service role (`auth.md`). The
  proxy gates `/expert` on a session; `/auth/redirect` dispatches by role and
  sends `expert_status = pending` to `/expert/apply`.
- `auth.md`, Data boundary: the service-role client is never imported by a
  client-role action. `public.set_updated_at()` exists (profiles migration).
- No `experts` table, no expert component and no `/expert` route existed.

## Decisions

### D1 — Writes go through `apply_as_expert`, not through grants or the service role

The user's own profile is user data, but `expert_status = pending` is a
`profiles` write the user may not make directly. Putting both in one
`security definer` function keyed on `auth.uid()` (owner `postgres`,
`search_path = ''`, `execute` granted to `authenticated` only) makes the
application one transaction and keeps the Server Action on the session
client. The function upserts on `user_id` — applying and editing are the
same call — and moves `expert_status` only from `none`; `approved` and
`rejected` are admin decisions it never touches. `experts` itself keeps the
table idiom: `revoke all`, `select` back to `authenticated` under an owner
policy, CRUD to `service_role`, no write grants for clients.

Rejected: owner insert/update policies on `experts` plus a separate status
write (two statements, and the status write still needs the service role);
a service-role Server Action (forbidden for client-role actions).

### D2 — Closed vocabularies

`lib/experts/catalogue.ts`: 16 competencies, NACE sections A–S, four
languages, four regions, three availability states — keys stored, labels
rendered. Stage 4 scores competency tags; a closed list keeps them
comparable across experts. The Zod schema (`lib/experts/schema.ts`) derives
its enums from the catalogue; the table bounds cardinalities and lengths but
does not re-check membership (a direct RPC with an unknown key would store a
tag nothing renders or matches — harmless, noted).

### D3 — One form, two pages

`ExpertProfileForm` (client, `useActionState` on `saveExpertProfile`)
serves both the application and the edit; on `saved` it calls
`router.refresh()` so the page re-decides from the profile's status.
`/expert/apply`: role `expert` → `/expert`; status `pending`/`rejected` →
`ExpertStatusCard`; `none` → heading + form. `/expert`: role ≠ `expert` →
`/expert/apply`; otherwise the approved card, a "no matches yet" placeholder
(stage 4 fills it), and the form prefilled from `getOwnExpert()` (RLS-scoped
session read). `AuthNav` reads `getUser()` instead of raw claims and links
"For experts" / "Expert area".

Three shadcn primitives were added for the form: `Textarea`, `Checkbox`,
`RadioGroup` (Radix `Checkbox` with `name`/`value` submits as a normal form
field, so the checkbox groups need no client state).

## Verification record

2026-08-22, dev environment, migration `20260822082432_create_experts_table`
pushed first. Scripted Chromium with minted cookies; SQL through the session
and service clients. Fixtures reset afterwards (rows deleted, B and the
harness user back to `client`/`none`).

1. `anon` on `experts` → "permission denied for table experts"; user B
   direct insert on `experts` → permission denied; B direct update of
   `profiles.expert_status` → permission denied. B `rpc('apply_as_expert')`
   with a minimal profile → row `Test Expert B` / "SQL-proof headline" /
   `[ergonomics]`, profile `{ role: client, expert_status: pending }`.
2. (After reset) B on `/expert/apply` (h1 "Apply as an EHS expert") filled
   name, headline, bio, 20 years, competencies `risk_assessment` +
   `machine_safety`, sector `C`, languages `de` + `en`, region `de-ch`,
   availability `limited` → row carries exactly those values; profile
   `client`/`pending`; `/auth/redirect` → `/expert/apply` with card title
   "Application received"; `/expert` → redirected to `/expert/apply`.
3. Harness user, `noValidate` set on the profile form, empty submit: the
   Server Action response carried `errors` for `full_name`, `headline`,
   `competencies`, `languages`; four `FieldError`s rendered ("Enter your
   name." …); 0 rows, status `none`. (A first attempt set `noValidate` on
   the header's logout form by mistake — native validation then blocked the
   submit; test bug, fixed.)
4. SQL set B `expert`/`approved` → `/auth/redirect` → `/expert`, card
   "Approved expert", headline prefilled; edited to "Machine safety and ISO
   45001 for manufacturing SMEs" → row updated, `updated_at`
   08:28:06 → 08:28:13, profile still `expert`/`approved`, "Saved." shown.
5. User A session on `experts` → 0 rows.
6. `npx tsc --noEmit`, `pnpm lint`, `pnpm build` green; registry updated.

## Files

New: migration `create_experts_table`, `lib/experts/{catalogue,schema,read}.ts`,
`actions/expert.ts`, `components/expert/{ExpertProfileForm,ExpertStatusCard}.tsx`,
`components/ui/{textarea,checkbox,radio-group}.tsx`, `app/expert/{layout,page}.tsx`,
`app/expert/apply/page.tsx`, this spec. Changed: `components/marketing/AuthNav.tsx`,
context docs.
