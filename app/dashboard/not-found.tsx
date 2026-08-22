import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

// Reached through notFound() on a run the caller does not own or that does not
// exist — the two are indistinguishable by design (auth.md, Data boundary).
export default function DashboardNotFound() {
  return (
    <div className="flex flex-col items-start gap-4 rounded-xl border border-border p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-medium tracking-tight">No such analysis</h1>
        <p className="text-muted-foreground">
          There is no analysis at this address in your account.
        </p>
      </div>
      <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>
        Your analyses
      </Link>
    </div>
  );
}
