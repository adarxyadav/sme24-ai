# Design

Tokens, typography, dashboard composition rules. The color rule itself lives in AGENTS.md ("Rules that never change"); this file documents the tokens.

## Tokens

Defined once in `app/globals.css` (shadcn CSS-variable scheme, OKLCH values). Components use only the Tailwind classes the tokens generate (`bg-background`, `text-muted-foreground`, `border-border`, `ring-ring`, …).

Direction: Perplexity's reading-room chrome — cream canvas, warm ink, one teal, no second accent (reference: shadcn.io/design/perplexity; Smith & Diction's "Scandinavian subway system" brief). Adapted, not copied: radius grammar stays shadcn's (a KPI ledger is not a search composer), and status colors exist because KPIs need them.

Dark mode is system preference: the same `:root` variables are re-assigned under `@media (prefers-color-scheme: dark)`, so a component written with semantic classes is dark-ready by construction. No `.dark` class, no theme toggle, no `dark:` variants in app code (the few inside `components/ui/` primitives are shadcn's own and resolve against the same media query).

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

Radius: `--radius: 0.625rem`; scale `rounded-sm/md/lg/xl/2xl…` derives from it. Small controls `rounded-md`, panels `rounded-lg`/`rounded-xl`.

## Dashboard composition rules

(not defined yet)
