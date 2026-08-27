import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/runs", label: "Runs" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/experts", label: "Experts" },
] as const;

// The admin surface's section nav. Plain links; the active page is the one
// the user is on, no client state needed.
export function AdminNav() {
  return (
    <nav aria-label="Admin sections" className="flex flex-wrap gap-2">
      {LINKS.map((link) => (
        <Link key={link.href} href={link.href} className={buttonVariants({ variant: "outline", size: "sm" })}>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
