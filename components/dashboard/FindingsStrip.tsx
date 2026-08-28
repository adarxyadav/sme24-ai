import { cn } from "@/lib/utils";

export type Finding = {
  // Absent when the section is omitted from the page — the entry keeps its
  // muted value but must not be a link to nowhere.
  href?: string;
  label: string;
  value: string;
  // A section with nothing to say renders muted in the strip instead of being
  // dressed up as a number (design-report-page.html).
  dim?: boolean;
};

// The findings line: the whole report as one strip — five entries in pipeline
// order, mono figures, each an anchor to its section. It is the abstract and
// the table of contents.
export function FindingsStrip({ findings }: { findings: Finding[] }) {
  return (
    <nav
      aria-label="Report contents"
      className="mt-3 grid overflow-clip rounded-lg border border-border bg-card md:grid-cols-5"
    >
      {findings.map((finding, index) => {
        const style = { animationDelay: `${index * 40}ms` };
        const entryClass = cn(
          "flex items-baseline justify-between gap-3 border-t border-border px-4 py-2.5",
          "first:border-t-0 md:grid md:content-start md:gap-1 md:border-t-0 md:border-l md:py-3 md:first:border-l-0",
          "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:fill-mode-backwards",
        );
        const content = (
          <>
            <span className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase whitespace-nowrap">
              {finding.label}
            </span>
            <span
              className={cn(
                "min-w-0 font-mono text-[13px] tabular-nums",
                finding.dim && "text-muted-foreground",
              )}
            >
              {finding.value}
            </span>
          </>
        );
        return finding.href ? (
          <a
            key={finding.label}
            href={finding.href}
            style={style}
            className={cn(entryClass, "transition-colors hover:bg-accent/50")}
          >
            {content}
          </a>
        ) : (
          <div key={finding.label} style={style} className={entryClass}>
            {content}
          </div>
        );
      })}
    </nav>
  );
}
