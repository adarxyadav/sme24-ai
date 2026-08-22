import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { AuthNav } from "@/components/marketing/AuthNav";
import { buttonVariants } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 font-medium"
        >
          <ShieldCheck className="size-5 text-primary" aria-hidden="true" />
          SME24
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-2">
          <Link href="/#packages" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            Packages
          </Link>
          <AuthNav />
        </nav>
      </div>
    </header>
  );
}
