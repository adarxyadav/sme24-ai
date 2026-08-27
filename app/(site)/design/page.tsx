import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Design system — SME24",
  robots: { index: false },
};

type Pair = { token: string; note: string; swatch: string; text: string };

// Class strings are literal so Tailwind can see them; names mirror design.md.
const pairs: Pair[] = [
  { token: "background / foreground", note: "page ground, body text", swatch: "bg-background border", text: "text-foreground" },
  { token: "card / card-foreground", note: "panels, KPI tiles", swatch: "bg-card border", text: "text-card-foreground" },
  { token: "popover / popover-foreground", note: "menus, tooltips", swatch: "bg-popover border", text: "text-popover-foreground" },
  { token: "primary / primary-foreground", note: "primary action, active state, brand mark", swatch: "bg-primary", text: "text-primary-foreground" },
  { token: "secondary / secondary-foreground", note: "secondary actions", swatch: "bg-secondary", text: "text-secondary-foreground" },
  { token: "muted / muted-foreground", note: "de-emphasised surfaces, supporting text", swatch: "bg-muted", text: "text-muted-foreground" },
  { token: "accent / accent-foreground", note: "hover, selected rows", swatch: "bg-accent", text: "text-accent-foreground" },
  { token: "destructive", note: "destructive actions, validation errors", swatch: "bg-destructive", text: "text-background" },
  { token: "success", note: "KPI within target, completed runs", swatch: "bg-success", text: "text-background" },
  { token: "warning", note: "KPI near limit, stale data", swatch: "bg-warning", text: "text-background" },
  { token: "info", note: "informational callouts", swatch: "bg-info", text: "text-background" },
  { token: "sidebar / sidebar-foreground", note: "dashboard sidebar (reserved)", swatch: "bg-sidebar border-sidebar-border border", text: "text-sidebar-foreground" },
  { token: "sidebar-primary / sidebar-primary-foreground", note: "sidebar active item", swatch: "bg-sidebar-primary", text: "text-sidebar-primary-foreground" },
  { token: "sidebar-accent / sidebar-accent-foreground", note: "sidebar hover", swatch: "bg-sidebar-accent", text: "text-sidebar-accent-foreground" },
];

const lines = [
  { token: "border", cls: "border-border" },
  { token: "input", cls: "border-input" },
  { token: "ring", cls: "border-ring" },
  { token: "sidebar-border", cls: "border-sidebar-border" },
  { token: "sidebar-ring", cls: "border-sidebar-ring" },
];

const charts = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5"];

const radii = [
  { token: "sm", cls: "rounded-sm" },
  { token: "md", cls: "rounded-md" },
  { token: "lg", cls: "rounded-lg" },
  { token: "xl", cls: "rounded-xl" },
  { token: "2xl", cls: "rounded-2xl" },
];

const type = [
  { role: "Marketing hero", cls: "text-4xl font-medium tracking-tight text-balance sm:text-5xl", sample: "Your safety KPIs, benchmarked." },
  { role: "Page title", cls: "text-2xl font-medium", sample: "Müller Metallbau AG" },
  { role: "Section title", cls: "text-lg font-medium", sample: "Lagging indicators" },
  { role: "Body", cls: "text-base", sample: "Three recordable injuries in the reporting year, none with lost time." },
  { role: "Dense body", cls: "text-sm", sample: "Source: Sustainability Report 2025, p. 41." },
  { role: "Supporting", cls: "text-sm text-muted-foreground", sample: "Last updated 2 hours ago" },
  { role: "Label", cls: "text-xs font-medium uppercase tracking-wide text-muted-foreground", sample: "Client-provided" },
  { role: "Mono — values", cls: "font-mono text-2xl tabular-nums", sample: "LTIFR 4.21 / 1'000'000 h" },
];

const variants = ["default", "outline", "secondary", "ghost", "destructive", "link"] as const;
const sizes = ["xs", "sm", "default", "lg"] as const;
const iconSizes = ["icon-xs", "icon-sm", "icon", "icon-lg"] as const;

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="grid gap-6 border-t py-10 sm:grid-cols-[10rem_1fr]">
      <h2 id={`${id}-h`} className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      <div className="grid gap-6">{children}</div>
    </section>
  );
}

export default function DesignPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      <header className="py-12">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Reference</p>
        <h1 className="mt-2 text-2xl font-medium">Design system</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Every token from <span className="font-mono">context/design.md</span>, rendered live. Switch your
          OS appearance to see the dark set — there is no toggle by design.
        </p>
      </header>

      <Section id="pairs" title="Surface pairs">
        <ul className="grid gap-2 sm:grid-cols-2">
          {pairs.map((p) => (
            <li key={p.token} className={`flex min-h-24 flex-col justify-between rounded-lg p-4 ${p.swatch} ${p.text}`}>
              <span className="font-mono text-sm">{p.token}</span>
              <span className="text-xs opacity-80">{p.note}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="status-text" title="Status as text">
        <ul className="flex flex-wrap gap-6 text-sm font-medium">
          <li className="text-success">LTIFR below sector median</li>
          <li className="text-warning">Report older than 18 months</li>
          <li className="text-destructive">Fatality recorded</li>
          <li className="text-info">Benchmark uses 12 peers</li>
        </ul>
      </Section>

      <Section id="lines" title="Lines">
        <ul className="flex flex-wrap gap-3">
          {lines.map((l) => (
            <li key={l.token} className={`rounded-md border-2 px-4 py-3 font-mono text-sm ${l.cls}`}>
              {l.token}
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">
          Focus ring in use:{" "}
          <button type="button" className="rounded-md border px-2 py-1 text-sm ring-3 ring-ring/50">
            focused control
          </button>
        </p>
      </Section>

      <Section id="charts" title="Chart ramp">
        <ul className="flex h-12 overflow-hidden rounded-lg border">
          {charts.map((c, i) => (
            <li key={c} className={`flex flex-1 items-end p-2 font-mono text-xs ${c}`}>
              <span className="rounded-sm bg-background/80 px-1 text-foreground">chart-{i + 1}</span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">Teal steps then warm stone — revisit with dashboard composition rules.</p>
      </Section>

      <Section id="radius" title="Radius">
        <ul className="flex flex-wrap gap-4">
          {radii.map((r) => (
            <li key={r.token} className={`flex size-20 items-center justify-center border-2 bg-card font-mono text-sm ${r.cls}`}>
              {r.token}
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">Controls use md; panels lg or xl.</p>
      </Section>

      <Section id="type" title="Type">
        <ul className="grid gap-6">
          {type.map((t) => (
            <li key={t.role} className="grid gap-1 sm:grid-cols-[9rem_1fr] sm:items-baseline">
              <span className="text-xs text-muted-foreground">{t.role}</span>
              <span className={t.cls}>{t.sample}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="buttons" title="Button">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="py-2 pr-4 font-medium">variant</th>
                {sizes.map((s) => (
                  <th key={s} scope="col" className="py-2 pr-4 font-mono font-medium normal-case tracking-normal">{s}</th>
                ))}
                {iconSizes.map((s) => (
                  <th key={s} scope="col" className="py-2 pr-4 font-mono font-medium normal-case tracking-normal">{s}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {variants.map((v) => (
                <tr key={v} className="border-t">
                  <th scope="row" className="py-3 pr-4 font-mono font-normal">{v}</th>
                  {sizes.map((s) => (
                    <td key={s} className="py-3 pr-4">
                      <Button variant={v} size={s}>Run report</Button>
                    </td>
                  ))}
                  {iconSizes.map((s) => (
                    <td key={s} className="py-3 pr-4">
                      <Button variant={v} size={s} aria-label="Add KPI">
                        <Plus aria-hidden="true" />
                      </Button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-muted-foreground">
          Disabled: <Button disabled>Run report</Button>
        </p>
      </Section>
    </div>
  );
}
