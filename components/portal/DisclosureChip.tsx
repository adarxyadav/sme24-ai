"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// A quiet disclosure toggle in the composer's footer. A closed section that
// still holds typed values marks the chip — a count when the section can hold
// several figures, a teal dot otherwise — so nothing typed ever looks lost.
export function DisclosureChip({
  id,
  label,
  controls,
  expanded,
  filled,
  count,
  onClick,
}: {
  id: string;
  label: string;
  controls: string;
  expanded: boolean;
  filled: boolean;
  count?: number;
  onClick: () => void;
}) {
  const marked = filled && !expanded;
  return (
    <Button
      id={id}
      type="button"
      variant="ghost"
      size="sm"
      aria-expanded={expanded}
      aria-controls={controls}
      onClick={onClick}
      className={cn(
        "rounded-full font-normal text-muted-foreground",
        expanded && "bg-accent text-foreground",
      )}
    >
      {marked ? (
        count ? null : (
          <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
        )
      ) : (
        <Plus aria-hidden="true" className="size-3.5" />
      )}
      {label}
      {marked && count ? (
        <span className="tabular-nums text-foreground">· {count}</span>
      ) : null}
    </Button>
  );
}
