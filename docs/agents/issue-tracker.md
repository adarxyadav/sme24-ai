# Issue tracker: context/tickets.md

This repo has **no external issue tracker**. Never call `gh issue create`,
`glab`, or write to GitHub Issues — the GitHub remote hosts code only.

`context/tickets.md` is the only queue.

## Conventions

- One file, three sections: `## Now`, `## Next`, `## Later`.
- Ticket ids are `T-NNN`, sequential, never reused.
- Every ticket carries exactly two fields — `What` (scope) and `Check`
  (the verifiable condition that counts as done).
- **The Check is fixed at ticket-creation time.** The doer never edits it.
  Only the repo owner changes what counts as done.
- New asks land under `## Later` first. Moving one up is an explicit trade.
- A done ticket gets a line in `context/log.md` and leaves `tickets.md`.

## When a skill says "publish to the issue tracker"

Add a ticket to `context/tickets.md` under `## Later`, in the format above.
Do not create files elsewhere. Do not open a GitHub issue.

## When a skill says "fetch the relevant ticket"

Read `context/tickets.md` and find the `T-NNN` heading.

## Specs

Specs are not tickets. A spec for `T-NNN` lives at
`context/product/t-NNN-spec.md`. It records decisions already made; it never
restates or reinterprets the ticket's Check — it quotes it verbatim as the
acceptance criteria.

## PRs as a request surface

Off. External PRs are not part of the queue.
