import Link from "next/link";
import { AuthNav } from "@/components/marketing/AuthNav";
import { AutoHideHeader } from "@/components/marketing/AutoHideHeader";
import { BrandMark } from "@/components/marketing/BrandMark";
import { buttonVariants } from "@/components/ui/button";

// Below md the center nav is hidden; the footer nav carries the same links (T-031).
const NAV_LINKS = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#for-experts", label: "Expert network" },
  { href: "/#packages", label: "Packages" },
] as const;

export function SiteHeader() {
  return (
    <AutoHideHeader>
      <div className="mx-auto grid h-14 w-full max-w-6xl grid-cols-[1fr_auto_1fr] items-center px-4 sm:px-6">
        <Link href="/" aria-label="SME24 — home" className="flex items-center justify-self-start">
          <BrandMark className="h-7 w-auto" />
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className={buttonVariants({ variant: "ghost", size: "sm" })}>
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2 justify-self-end">
          <AuthNav />
        </div>
      </div>
    </AutoHideHeader>
  );
}
