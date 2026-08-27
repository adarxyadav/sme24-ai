import Link from "next/link";
import { ThemeToggle } from "@/components/marketing/ThemeToggle";

const LINKS = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#packages", label: "Packages" },
  { href: "/expert/apply", label: "For experts" },
  { href: "/login", label: "Sign in" },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex flex-col gap-1">
          <p>© {new Date().getFullYear()} SME24</p>
          <p>EHS consulting marketplace for Swiss SMEs</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <nav aria-label="Footer" className="flex flex-wrap gap-x-4 gap-y-1">
            {LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="underline-offset-4 hover:text-foreground hover:underline">
                {link.label}
              </Link>
            ))}
          </nav>
          <ThemeToggle />
        </div>
      </div>
    </footer>
  );
}
