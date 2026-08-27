"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, LayoutDashboard, Plus, Shield } from "lucide-react";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import type { UserRole } from "@/lib/auth/get-user";

type NavItem = {
  title: string;
  href: string;
  icon: typeof LayoutDashboard;
};

const BASE_ITEMS: NavItem[] = [
  { title: "Your analyses", href: "/dashboard", icon: LayoutDashboard },
  { title: "New search", href: "/", icon: Plus },
];

// Only roles that own a surface get its link; a client sees neither.
const ROLE_ITEMS: Partial<Record<UserRole, NavItem>> = {
  expert: { title: "Expert area", href: "/expert", icon: Briefcase },
  admin: { title: "Admin", href: "/admin", icon: Shield },
};

export function DashboardNav({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const roleItem = ROLE_ITEMS[role];
  const items = roleItem ? [...BASE_ITEMS, roleItem] : BASE_ITEMS;

  return (
    <SidebarMenu>
      {items.map((item) => (
        <SidebarMenuItem key={item.href}>
          <SidebarMenuButton
            asChild
            isActive={
              pathname === item.href || pathname.startsWith(`${item.href}/`)
            }
          >
            <Link href={item.href} onClick={() => setOpenMobile(false)}>
              <item.icon aria-hidden="true" />
              <span>{item.title}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}
