import type { Metadata } from "next";
import { SearchForm } from "@/components/portal/SearchForm";

export const metadata: Metadata = {
  title: "New search — SME24",
  robots: { index: false, follow: false },
};

// The dashboard's default page is the intake (T-034), composed as a centered
// ask bar (T-037); the run list lives in the sidebar's Analyses group. The
// proxy gates this path on a session.
export default function NewSearchPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8">
      <header className="flex flex-col items-center gap-1.5 text-center">
        <h1 className="text-2xl font-medium tracking-tight sm:text-[1.65rem]">
          Benchmark your safety performance
        </h1>
        <p className="text-muted-foreground">
          Company name in, free report out. Figures optional.
        </p>
      </header>
      <SearchForm />
    </div>
  );
}
