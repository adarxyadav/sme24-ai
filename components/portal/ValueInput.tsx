"use client";

import { cn } from "@/lib/utils";

// Tolerant of locale formatting: apostrophes/spaces as thousand separators,
// comma or dot as the decimal mark. Returns null (drop the field, never block
// submit) for blanks, garbage and negatives; a typed zero survives.
export function parseLocaleNumber(raw: string): number | null {
  let text = raw.replace(/['’\s_  ]/g, "");
  if (text === "") return null;
  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  if (lastComma !== -1 && lastDot !== -1) {
    // Both present: the later one is the decimal mark, the other groups.
    text =
      lastComma > lastDot
        ? text.replace(/\./g, "").replace(",", ".")
        : text.replace(/,/g, "");
  } else if (lastComma !== -1) {
    // Comma only: one comma with 1–2 digits after reads as a decimal mark
    // ("1,4"); anything else reads as grouping ("800,000").
    const decimal = /^[^,]*,\d{1,2}$/.test(text);
    text = decimal ? text.replace(",", ".") : text.replace(/,/g, "");
  }
  const value = Number(text);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

// A Notion-style value cell: visual weight carries the state, so filled rows
// read apart from empty ones without extra chrome around the ledger.
export function ValueInput({
  value,
  dirty = false,
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "type" | "value"> & {
  value: string;
  dirty?: boolean;
}) {
  const filled = value.trim() !== "";
  return (
    <input
      type="text"
      inputMode="decimal"
      value={value}
      className={cn(
        "rounded-sm border px-2 py-1 text-right font-mono text-sm tabular-nums outline-none",
        "transition-[color,box-shadow,border-color,background-color]",
        "placeholder:text-muted-foreground/50",
        filled
          ? "border-border bg-card shadow-xs"
          : "border-transparent bg-transparent hover:bg-muted",
        dirty && "border-foreground/40",
        "focus:border-ring focus:bg-card focus:ring-3 focus:ring-ring/50",
        className,
      )}
      {...props}
    />
  );
}
