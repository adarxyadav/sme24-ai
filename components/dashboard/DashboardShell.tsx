import Link from "next/link";
import { LogOut } from "lucide-react";
import { logout } from "@/actions/auth";
import { SkipLink } from "@/components/a11y/SkipLink";
import { DashboardNav } from "@/components/dashboard/DashboardNav";
import { BrandMark } from "@/components/marketing/BrandMark";
import { ThemeToggle } from "@/components/marketing/ThemeToggle";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import type { UserRole } from "@/lib/auth/get-user";

// The dashboard's own chrome: replaces SiteShell on /dashboard (T-033).
export function DashboardShell({
  email,
  role,
  children,
}: {
  email: string | null;
  role: UserRole;
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <SkipLink />
      <Sidebar>
        <SidebarHeader>
          <Link
            href="/"
            aria-label="SME24 — home"
            className="flex items-center rounded-md px-2 py-1.5"
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
        </SidebarContent>
        <SidebarFooter>
          <ThemeToggle />
          {email ? (
            <span className="truncate px-2 text-xs text-muted-foreground">
              {email}
            </span>
          ) : null}
          <form action={logout}>
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="w-full justify-start"
            >
              <LogOut aria-hidden="true" />
              Log out
            </Button>
          </form>
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
