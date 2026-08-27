import { NotFoundCard } from "@/components/marketing/NotFoundCard";
import { SiteShell } from "@/components/marketing/SiteShell";

// The global fallback for unmatched URLs renders straight under the root
// layout, outside the (site) group — it must bring the shell itself or the
// 404 loses the header, footer, skip link and main landmark. notFound() from
// a (site) page is caught by app/(site)/not-found.tsx instead, which already
// sits inside SiteShell.
export default function NotFound() {
  return (
    <SiteShell>
      <NotFoundCard />
    </SiteShell>
  );
}
