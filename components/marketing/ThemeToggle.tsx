"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

const MODES = [
  { value: "light", label: "Light mode", icon: Sun },
  { value: "dark", label: "Dark mode", icon: Moon },
  { value: "system", label: "System mode", icon: Monitor },
] as const;

const emptySubscribe = () => () => {};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  // The stored choice exists only client-side; hydration-safe "mounted" without an effect.
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  return (
    <div role="group" aria-label="Color mode" className="flex w-fit items-center gap-0.5 rounded-md border p-0.5">
      {MODES.map(({ value, label, icon: Icon }) => {
        const active = mounted && theme === value;
        return (
          <Button
            key={value}
            type="button"
            variant={active ? "secondary" : "ghost"}
            size="icon-xs"
            aria-label={label}
            aria-pressed={active}
            onClick={() => setTheme(value)}
          >
            <Icon className="size-3.5" />
          </Button>
        );
      })}
    </div>
  );
}
