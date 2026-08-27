import Link from "next/link";
import { cookies } from "next/headers";
import { SkipLink } from "@/components/a11y/SkipLink";
import {
  AnalysesNav,
  type AnalysisNavItem,
} from "@/components/dashboard/AnalysesNav";
import { DashboardNav } from "@/components/dashboard/DashboardNav";
import { UserMenu } from "@/components/dashboard/UserMenu";
import { BrandMark } from "@/components/marketing/BrandMark";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import type { UserRole } from "@/lib/auth/get-user";

// The dashboard's own chrome: replaces SiteShell on /dashboard (T-033).
export async function DashboardShell({
  email,
  role,
  runs,
  children,
}: {
  email: string | null;
  role: UserRole;
  runs: AnalysisNavItem[];
  children: React.ReactNode;
}) {
  // SidebarProvider writes sidebar_state on toggle but never reads it back —
  // restoring the collapse across loads is the server's job (shadcn contract).
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <SkipLink />
      <Sidebar>
        <SidebarHeader>
          <Link
            href="/"
            aria-label="SME24 — home"
            className="flex items-center rounded-sm px-2 py-1.5"
          >
            <BrandMark className="h-6 w-auto" />
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <DashboardNav role={role} />
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel>Analyses</SidebarGroupLabel>
            <SidebarGroupContent>
              <AnalysesNav runs={runs} />
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <UserMenu email={email} />
        </SidebarFooter>
      </Sidebar>
      <SidebarInset id="main">
        <header className="flex h-12 shrink-0 items-center border-b px-4">
          <SidebarTrigger />
        </header>
        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-12 sm:px-6">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
