"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// Within this scroll depth the header never hides, so it cannot flicker at the top edge.
const TOP_REVEAL_PX = 64;

export function AutoHideHeader({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    lastY.current = window.scrollY;
    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      window.requestAnimationFrame(() => {
        const y = window.scrollY;
        setHidden(y > TOP_REVEAL_PX && y > lastY.current);
        lastY.current = y;
        ticking.current = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      // Keyboard focus entering the header must reveal it — tabbing into an off-screen bar traps nothing visible.
      onFocusCapture={() => setHidden(false)}
      className={cn(
        "sticky top-0 z-40 border-b bg-background transition-transform motion-reduce:transition-none",
        hidden ? "-translate-y-full" : "translate-y-0",
      )}
    >
      {children}
    </header>
  );
}
