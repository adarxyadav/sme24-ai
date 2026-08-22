"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Polls by re-rendering the Server Component tree: router.refresh() re-runs
// the page's read-layer query and merges the new RSC payload without a reload
// (t-014-spec.md). Rendered only while the run is queued or in progress, so
// a terminal page carries no timer. The dashboard never learns a Trigger.dev
// run id — the read layer's row is the only thing re-read.
const POLL_MS = 5_000;

export function RunProgress() {
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => router.refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [router]);

  return (
    <p className="text-xs text-muted-foreground" aria-live="polite">
      This page updates automatically.
    </p>
  );
}
