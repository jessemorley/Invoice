"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Receipt,
  Users,
  Settings,
  Wallet,
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ModeToggle } from "@/components/mode-toggle";
import { cn } from "@/lib/utils";

const navItems = [
  { view: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { view: "entries", label: "Entries", icon: FileText },
  { view: "invoices", label: "Invoices", icon: Receipt },
  { view: "clients", label: "Clients", icon: Users },
  { view: "expenses", label: "Expenses", icon: Wallet },
  { view: "settings", label: "Settings", icon: Settings },
];

function NavItem({
  view,
  label,
  icon: Icon,
  currentView,
  onNavigate,
}: (typeof navItems)[0] & { currentView: string; onNavigate: (view: string) => void }) {
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

function NavUser() {
  const { isMobile } = useSidebar();
  const router = useRouter();
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src="" alt="User" />
                <AvatarFallback className="rounded-lg">JD</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">Jane Doe</span>
                <span className="truncate text-xs text-muted-foreground">jane@example.com</span>
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
                  <AvatarImage src="" alt="User" />
                  <AvatarFallback className="rounded-lg">JD</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">Jane Doe</span>
                  <span className="truncate text-xs text-muted-foreground">jane@example.com</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.replace("/?view=settings", { scroll: false })}>
              <Settings />Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <LogOut />Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

export function AppSidebar() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const currentView = searchParams.get("view") ?? "entries";
  const { open } = useSidebar();

  const handleNavigate = (view: string) => {
    if (currentView === view) {
      window.dispatchEvent(new CustomEvent("dock:focus-search"));
    } else {
      router.replace(`/?view=${view}`, { scroll: false });
    }
  };

  return (
    <Sidebar collapsible="icon" className="hidden md:flex border-r">
      <SidebarHeader className="px-4 py-4">
        <div className="flex items-center gap-2.5 h-8">
          <Image src="/app_icon.png" alt="Invoicing" width={28} height={28} className="size-7 rounded-md shrink-0" />
          {open && <span className="text-sm font-semibold tracking-tight">Invoicing</span>}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="px-3 py-1">
          <SidebarGroupContent>
            <SidebarMenu className="gap-2">
              {navItems.map((item) => (
                <NavItem key={item.view} {...item} currentView={currentView} onNavigate={handleNavigate} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center justify-between px-1 py-1">
          <ModeToggle />
        </div>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
