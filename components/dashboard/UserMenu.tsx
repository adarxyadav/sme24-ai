"use client";

import { useTheme } from "next-themes";
import { ChevronsUpDown, LogOut, Monitor, Moon, Sun } from "lucide-react";
import { logout } from "@/actions/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const THEMES = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

// The sidebar footer's account menu (T-038): one trigger, everything
// account-scoped behind it. The menu content mounts only once opened —
// after hydration — so useTheme needs no mounted guard here, unlike
// ThemeToggle, which renders the active choice into server HTML.
export function UserMenu({ email }: { email: string | null }) {
  const { isMobile } = useSidebar();
  const { theme, setTheme } = useTheme();
  const initial = email?.trim().charAt(0).toUpperCase() || "?";

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" aria-label="Account menu">
              <Avatar size="sm">
                <AvatarFallback>{initial}</AvatarFallback>
              </Avatar>
              <span className="truncate">{email ?? "Account"}</span>
              <ChevronsUpDown
                aria-hidden="true"
                className="ml-auto text-muted-foreground"
              />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side={isMobile ? "top" : "right"}
            align="end"
            sideOffset={8}
            className="w-56"
          >
            {email ? (
              <>
                <DropdownMenuLabel className="truncate font-normal">
                  {email}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
              </>
            ) : null}
            <DropdownMenuRadioGroup
              value={theme ?? "system"}
              onValueChange={setTheme}
            >
              {THEMES.map(({ value, label, icon: Icon }) => (
                <DropdownMenuRadioItem key={value} value={value}>
                  <Icon aria-hidden="true" className="text-muted-foreground" />
                  {label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <form action={logout}>
              <DropdownMenuItem asChild>
                <button type="submit" className="w-full">
                  <LogOut aria-hidden="true" className="text-muted-foreground" />
                  Log out
                </button>
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
