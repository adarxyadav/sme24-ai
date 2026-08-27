# Design

Tokens, typography, dashboard composition rules. The color rule itself lives in AGENTS.md ("Rules that never change"); this file documents the tokens.

## Tokens

Defined once in `app/globals.css` (shadcn CSS-variable scheme, OKLCH values). Components use only the Tailwind classes the tokens generate (`bg-background`, `text-muted-foreground`, `border-border`, `ring-ring`, …).

Direction: Perplexity's reading-room chrome — cream canvas, warm ink, one teal, no second accent (reference: shadcn.io/design/perplexity; Smith & Diction's "Scandinavian subway system" brief). Adapted, not copied: radius grammar stays shadcn's (a KPI ledger is not a search composer), and status colors exist because KPIs need them.

Dark mode is class-based: the same `:root` variables are re-assigned under `.dark`, so a component written with semantic classes is dark-ready by construction. The class is managed by `next-themes` (`ThemeProvider` in the root layout: light is the default, system preference applies only when chosen) and switched by the footer's `ThemeToggle` — light / dark / system. No `dark:` variants in app code (the few inside `components/ui/` primitives are shadcn's own and resolve against the `.dark` custom variant).

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `background` / `foreground` | cream `oklch(0.989 0.003 49)` / warm ink `oklch(0.264 0.013 94)` | warm near-black `oklch(0.21 0.006 80)` / dim cream | page ground and body text |
| `card`, `popover` (+ `-foreground`) | cream (elevation by hairline, not tone) | one step raised | panels, KPI tiles, menus |
| `primary` / `primary-foreground` | teal `oklch(0.478 0.081 203)` (#016a71) / cream | bright teal `oklch(0.646 0.110 203)` (#00a1ac) / near-black | the only brand color — primary action, focus, brand mark, links |
| `secondary` / `secondary-foreground` | warm stone `oklch(0.892 0.010 88)` | mid warm | secondary actions, chips |
| `muted` / `muted-foreground` | light stone / warm grey `oklch(0.50 0.014 90)` | dark warm / light warm grey | de-emphasised surfaces, supporting text |
| `accent` / `accent-foreground` | light stone | mid warm | hover, selected rows — tonal, never teal |
| `destructive` | clay red `oklch(0.492 0.143 16)` | lighter clay | destructive actions, errors, fatality-class KPI states |
| `success` | forest `oklch(0.50 0.12 144)` | lighter forest | KPI within target, completed runs |
| `warning` | burnt orange `oklch(0.487 0.124 44)` | lighter orange | KPI near limit, stale data |
| `info` | indigo `oklch(0.473 0.158 266)` | lighter indigo | informational callouts; rare |
| `border` / `input` / `ring` | stone hairline / darker stone / teal 60% | white 10% / white 18% / teal 60% | hairlines, field borders, focus ring |
| `chart-1…5` | teal, bright teal, pale teal, warm grey, stone | reversed teal steps, then warm greys | charts; untuned |
| `sidebar-*` | cream-stone set, active item = ink | dark warm set, active item = cream | dashboard sidebar (reserved); active state tonal, not teal |

Status tokens are text-safe on `background` in both modes (≥ 4.5:1, checked) and carry `text-background` when used as fills. Elevation is hairline-only — no drop shadows.

Radius: `--radius: 0.625rem`; scale `rounded-sm/md/lg/xl/2xl…` derives from it. Small controls `rounded-md`, panels `rounded-lg`/`rounded-xl`. One exception (T-037, owner-approved): the search composer's own controls — disclosure chips, attachment chip, submit circle — are pills (`rounded-full`); the composer panel stays `rounded-xl`. The pill grammar belongs to the composer alone and does not travel to other surfaces.

## Dashboard composition rules

### Derived figures

A figure computed at display time from stored rows (`kpi-contract.md`, Derivation rules) is never dressed as a disclosure:

- The value is prefixed with `≈` inside the same `tabular-nums` span as a disclosed value, same weight; no colour change — the approximation mark carries the meaning, not a token.
- Directly under the value, one line in `text-xs text-muted-foreground` states the formula with the inputs' figures, e.g. `≈ 580` / `TRIR 1.13 × 512’000’000 h ÷ 1’000’000`. The formula names the metrics in the ledger's own labels.
- The Confidence cell shows an outline `Badge` reading `derived` in `text-muted-foreground`, and the Source cell reads "Derived from &lt;inputs&gt;" — a derived row has no URL and no excerpt of its own.
- A derived row renders only when every input is a stored row with a non-null value on the same base (per 1'000'000 hours); a disclosed count always replaces the derived one.
- The incident-cost card uses a derived count exactly like a stored one and lists it under a "Derived counts used" note with the same formula line.

### Shell

`/dashboard` renders inside `DashboardShell`, not `SiteShell` (T-033): a shadcn sidebar (offcanvas below `md`, collapse state in a cookie) plus a slim top bar carrying only the sidebar trigger; page content sits in a `max-w-5xl` column. Sidebar chrome uses the `sidebar-*` tokens exclusively — the active nav item is tonal (`sidebar-accent`), never teal. On this surface the sidebar footer owns the theme toggle, the account identity and Log out; `SiteFooter` does not render. The run history lives only in the sidebar's "Analyses" group, chat-history style (T-035) — one truncated company name per run, no status decoration; state belongs to the run page.

### Intake

`/dashboard`'s intake is a single ask bar anchored in the upper third of the inset (T-037, mockup `context/product/design-search-composer.html`) — anchored, not centered, so the floating panel below always has room and the block never re-centers: greeting + one large autofocused company-name input in a hairline `rounded-xl` panel. Everything optional lives behind three quiet footer controls — attach (paperclip; the PDF renders as a removable chip), and the `Website` / `Your figures` disclosures, which float below the bar as panels (`popover` tokens) — the composer never grows and the page never reflows. One panel open at a time; the figures panel is a quiet ledger — single-line rows (label left, `ValueInput` cell right), one muted caption per basis group ("Per 1'000'000 hours worked" over the rates, "Past year" over the counts and hours) instead of a subtitle repeated on every row, the reporting period as the first row in the same cell grammar, half-strength row dividers (`divide-border/50`), a count in the header only once something is filled ("2 added" — nothing when empty, the ghost cells already say optional), and a one-sentence consequence footer (figures you enter override what we research and appear as client-provided). The cell is the control: fully ghost while empty — no border, no fill, just the placeholder, a realistic example value at half strength (format and magnitude, never an instruction), `bg-muted` on hover only; lifted to `card` with border + `shadow-xs` once it holds any non-whitespace text, so filled rows scan at a glance; ring + lift on focus; right-aligned mono `tabular-nums`. Plain text with `inputMode="decimal"`, never `type="number"` — locale formats ("1,2", "500'000") parse tolerantly at submit and unparseable fields drop silently instead of blocking. Enter advances to the next row; on the last row it falls through to submit. No Done pill — Escape, any press outside the composer, and submit close the panel. The ledger outgrows short desktop folds: the fit fallback (max-height measured to the fold on open/resize, cap 32rem) scrolls the panel internally, never past the viewport; Escape closes and returns focus to the chip; a closed figures chip with values reads "Your figures · N" (the Website chip keeps the teal dot). Closed sections stay mounted so typed values always submit; a closed section holding a value marks its chip with a teal dot. Teal appears exactly once: the submit circle (spinner while pending). Chip open state is tonal (`accent`), never teal. One focus surface at a time: the bar's ring reflects only its own fields — a panel holding focus leaves the bar at rest (the panels are siblings of the bar, not children). Errors are one line under the composer (alert icon + copy).

Everything else in this section is still undefined.
