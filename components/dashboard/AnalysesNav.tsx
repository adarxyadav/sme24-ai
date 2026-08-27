"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

export type AnalysisNavItem = { id: string; companyName: string };

// The run history as sidebar items, chat-history style (T-035): the open
// run is the active item; the run page itself carries status and detail.
export function AnalysesNav({ runs }: { runs: AnalysisNavItem[] }) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  if (runs.length === 0) {
    return (
      <p className="px-2 py-1.5 text-xs text-muted-foreground">
        No analyses yet.
      </p>
    );
  }

  return (
    <SidebarMenu>
      {runs.map((run) => (
        <SidebarMenuItem key={run.id}>
          <SidebarMenuButton
            asChild
            isActive={pathname === `/dashboard/runs/${run.id}`}
          >
            <Link
              href={`/dashboard/runs/${run.id}`}
              onClick={() => setOpenMobile(false)}
              title={run.companyName}
            >
              <span className="truncate">{run.companyName}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}
