// The report's chapter rule: numbered because the pipeline is a real
// sequence — each stage reads the one before it (design-report-page.html).
export function ChapterRule({ n, title }: { n: number; title: string }) {
  return (
    <div className="flex items-baseline gap-2.5">
      <span className="font-mono text-xs text-muted-foreground tabular-nums">
        {n}
      </span>
      <span className="text-sm font-medium whitespace-nowrap">{title}</span>
      <span aria-hidden="true" className="h-px flex-1 self-center bg-border" />
    </div>
  );
}
