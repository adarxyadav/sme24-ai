import { NotFoundCard } from "@/components/marketing/NotFoundCard";

// Catches notFound() bubbled from (site) pages — the (site) layout already
// wraps this in SiteShell, so the card comes bare (the root app/not-found.tsx
// would double the shell here).
export default function SiteNotFound() {
  return <NotFoundCard />;
}
