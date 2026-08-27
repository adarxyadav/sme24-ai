import type { Metadata } from "next";
import { SearchForm } from "@/components/portal/SearchForm";

export const metadata: Metadata = {
  title: "New search — SME24",
  robots: { index: false, follow: false },
};

// The dashboard's default page is the intake (T-034); the run list lives at
// /dashboard/runs. The proxy gates this path on a session.
export default function NewSearchPage() {
  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-medium tracking-tight">New search</h1>
        <p className="text-muted-foreground">
          Start a free report from your company name.
        </p>
      </header>
      <SearchForm />
    </>
  );
}
