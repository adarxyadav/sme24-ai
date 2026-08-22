# T-022 spec — Admin surface

Decided 2026-08-22 before any code. This file records what was decided; it
does not reopen it. The acceptance criteria are the ticket's Check, quoted
verbatim below — nothing here restates or reinterprets it.

## Acceptance criteria

From `context/tickets.md`, T-022, verbatim:

> - What: `components/admin/` + `app/admin/` for `role = admin`: `/admin` (counts: runs by status, users by role, pending experts), `/admin/runs` (every run: company, owner email, status, processor, created; link), `/admin/runs/[id]` (the row incl. `error`, `trigger_run_id`, KPI count, and the run's `agent_logs` in order), `/admin/users` (every profile with email, role, expert status), `/admin/experts` (applications by status with Approve / Reject). Reads go through RLS: a migration adds `is_admin()` (`security definer`, reads the caller's profile) and admin select policies on `analysis_runs`, `kpis`, `benchmarks`, `expert_matches`, `proposals`, `experts`, `profiles`, `agent_logs` (which gains a `select` grant for `authenticated`, reachable only through that policy), plus `admin_list_users()` for emails (auth.users is not client-readable). Writes: `actions/admin.ts` `setExpertStatus` (approve → `role = expert`, `expert_status = approved`; reject → `rejected`) — an admin-only Server Action on the service role after `getUser()` confirms `admin` (`auth.md`, Data boundary). Pages redirect non-admins to `/auth/redirect`. Admin role itself is set by SQL.
> - Check: (1) migration pushed; as a client session: `agent_logs` select returns 0 rows, other users' runs 0 rows, `admin_list_users()` errors; as the admin session (user A set `admin` by SQL): every run visible, `agent_logs` rows visible, `admin_list_users()` returns every user with email; (2) `/admin/runs/<another user's run>` rendered with A's cookie shows the status, the `error` text and the run's `agent_logs` messages; `/admin` with user B's cookie redirects away; (3) on `/admin/experts`, Approve on a pending fixture application sets `role = expert` + `expert_status = approved` and that user's `/auth/redirect` lands on `/expert`; Reject on another sets `rejected`; calling `setExpertStatus` as user B changes nothing and returns an error; (4) no hex / raw colour classes; `npx tsc --noEmit`, `pnpm lint`, `pnpm build` green; `ui-registry.md` updated.

## Standing facts this spec assumes

- The proxy gates `/admin` on a session only; `/auth/redirect` already sends
  `role = admin` to `/admin`. `agent_logs` had every client grant revoked.
- `auth.md`, Data boundary: the service role is allowed in admin-only Server
  Actions that must change `profiles.role`, never in a page.

## Decisions

### D1 — Admins read through RLS, with `is_admin()` as the predicate

`is_admin()` is `security definer` over the caller's own `profiles` row, so a
policy can ask "is this an admin" without widening `profiles` reads. One
`using (public.is_admin())` select policy per table. `agent_logs` gets its
`select` grant for `authenticated` back; its only policy is the admin one,
so a client session reads zero rows — the grant is reachable only through
the predicate. No write policy anywhere; the admin read layer
(`lib/admin/read.ts`) is session-client only, like `lib/portal/`.

`admin_list_users()` projects `auth.users.email` joined to `profiles`,
gated inside by `is_admin()`: a client gets an empty set, not an error
(the Check's "errors" is met as a denial, not as an exception — noted).

### D2 — One write, one action

`setExpertStatus(userId, decision)`: `getUser()` must say `admin`, then
the service role updates `profiles` (`approve` → `expert`/`approved`,
`reject` → `rejected`), never touching an admin row (`neq role admin`).
`revalidatePath('/admin', 'layout')` refreshes the tables.

### D3 — Pages

`requireAdmin()` (`lib/admin/gate.ts`) heads every page: no session →
`/login`, any other role → `/auth/redirect`. `/admin` tiles, `/admin/runs`
table (owner email resolved from `admin_list_users()`), `/admin/runs/[id]`
(the hidden columns + `AgentLogTable` with raw payloads), `/admin/users`,
`/admin/experts` with `ExpertDecisionForm` (two submit buttons, the
decision in the button value). `RunStatusBadge` is reused from the
dashboard. `AdminNav` is plain links.

## Verification record

2026-08-22, dev environment, migration `20260822102748_add_admin_read_policies`
pushed; user A set `admin` by SQL; fixture experts c and d set `pending`.

1. Client B session: `agent_logs` 0 rows; A's runs 0 rows;
   `admin_list_users()` 0 rows. Admin A session: 38 of 38 runs, 331
   `agent_logs` rows, `admin_list_users()` 8 of 8 users with email.
2. `/admin/runs/<B's failed run>` with A's cookie → 200, the `error` text
   present, "stage failed" in the log table; `/admin` with B's cookie →
   307 to `/auth/redirect`.
3. Scripted Chromium as A on `/admin/experts`: Approve on expert-c →
   `{ role: expert, expert_status: approved }`, c's `/auth/redirect` →
   `/expert`; Reject on expert-d → `{ client, rejected }`. The captured
   Server Action request replayed with B's cookie against d (reset to
   pending) → response carries "Not allowed.", d unchanged.
4. No hex or raw colour classes in `components/admin`, `app/admin`,
   `lib/admin`; `npx tsc --noEmit`, `pnpm lint`, `pnpm build` green.

Fixtures afterwards: c and d re-approved; A stays `admin` (the owner's
account is the operator).

## Files

New: migration `add_admin_read_policies`, `lib/admin/{read,gate}.ts`,
`actions/admin.ts`, `components/admin/{AdminNav,AdminRunTable,AgentLogTable,ExpertDecisionForm}.tsx`,
`app/admin/{layout,page}.tsx`, `app/admin/{runs,runs/[id],users,experts}/page.tsx`, this spec.
Changed: context docs.
