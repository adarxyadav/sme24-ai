import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

// The one 404 body, shared by the root fallback (which brings SiteShell
// itself) and the (site) boundary (which already sits inside SiteShell).
export function NotFoundCard() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-start justify-center gap-4 px-4 py-16 sm:px-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-medium tracking-tight">Page not found</h1>
        <p className="text-muted-foreground">
          There is nothing at this address.
        </p>
      </div>
      <Link href="/" className={buttonVariants({ variant: "outline" })}>
        Back to the start
      </Link>
    </div>
  );
}
