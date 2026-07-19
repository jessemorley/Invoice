"use client";

import Image from "next/image";
import { useActiveView, type ViewId } from "@/components/active-view-context";
import { signOut } from "@/app/login/actions";
import {
  LayoutDashboard,
  FileText,
  Receipt,
  Mail,
  Users,
  Settings,
  Wallet,
  Landmark,
  ChevronsUpDown,
  LogOut,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const navItems: { view: ViewId; label: string; icon: React.ComponentType }[] = [
  { view: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { view: "entries", label: "Entries", icon: FileText },
  { view: "invoices", label: "Invoices", icon: Receipt },
  { view: "emails", label: "Emails", icon: Mail },
  { view: "clients", label: "Clients", icon: Users },
  { view: "expenses", label: "Expenses", icon: Wallet },
  { view: "tax", label: "Tax", icon: Landmark },
  { view: "settings", label: "Settings", icon: Settings },
];

function NavItem({
  view,
  label,
  icon: Icon,
  currentView,
  onNavigate,
}: (typeof navItems)[0] & { currentView: ViewId; onNavigate: (view: ViewId) => void }) {
  const isActive = currentView === view;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActive}
        onClick={() => onNavigate(view)}
        className={cn("cursor-pointer")}
      >
        <Icon />
        <span>{label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function NavUser({ name, email }: { name: string; email: string }) {
  const { isMobile } = useSidebar();
  const { setView } = useActiveView();
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" className="cursor-pointer data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{name}</span>
                <span className="truncate text-xs text-muted-foreground">{email}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{name}</span>
                  <span className="truncate text-xs text-muted-foreground">{email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setView("settings", { settingsTab: "account" })}>
              <Settings />Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut()}>
              <LogOut />Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

export function AppSidebar({ user }: { user: { name: string; email: string } }) {
  const { view: activeView, setView } = useActiveView();

  const handleNavigate = (v: ViewId) => {
    setView(v);
  };

  return (
    <Sidebar collapsible="icon" className="hidden md:flex border-r">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="pointer-events-none">
              <Image src="/app_icon.png" alt="Invoicing" width={32} height={32} className="size-8 rounded-md shrink-0" />
              <span className="text-sm font-semibold tracking-tight">Invoicing</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="px-3 py-1 group-data-[collapsible=icon]:px-2">
          <SidebarGroupContent>
            <SidebarMenu className="gap-2">
              {navItems.map((item) => (
                <NavItem key={item.view} {...item} currentView={activeView} onNavigate={handleNavigate} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser name={user.name} email={user.email} />
      </SidebarFooter>
    </Sidebar>
  );
}
