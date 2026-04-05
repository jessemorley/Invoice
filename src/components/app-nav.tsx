"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Receipt,
  Users,
  Settings,
  Wallet,
  Calendar,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const mainTabs = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/entries", label: "Entries", icon: FileText },
  { href: "/invoices", label: "Invoices", icon: Receipt },
  { href: "/clients", label: "Clients", icon: Users },
];

const overflowItems = [
  { href: "/expenses", label: "Expenses", icon: Wallet },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/calendar", label: "Calendar", icon: Calendar },
];

const allItems = [...mainTabs, ...overflowItems];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-56 md:flex-col md:border-r border-border bg-background">
      <div className="px-4 py-5">
        <h1 className="text-sm font-semibold tracking-tight text-foreground">
          Invoicing
        </h1>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 px-2">
        {allItems.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export function BottomTabs() {
  const pathname = usePathname();
  const [overflowOpen, setOverflowOpen] = useState(false);

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t border-border bg-background">
      <div className="flex items-center justify-around h-14">
        {mainTabs.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1 text-[11px] font-medium transition-colors",
                active
                  ? "text-foreground"
                  : "text-muted-foreground"
              )}
            >
              <item.icon className={cn("h-5 w-5", active && "text-foreground")} />
              {item.label}
            </Link>
          );
        })}
        <Sheet open={overflowOpen} onOpenChange={setOverflowOpen}>
          <SheetTrigger
            className="flex flex-col items-center gap-0.5 px-3 py-1 text-[11px] font-medium text-muted-foreground"
          >
            <MoreHorizontal className="h-5 w-5" />
            More
          </SheetTrigger>
          <SheetContent side="bottom" className="pb-safe">
            <SheetHeader>
              <SheetTitle>More</SheetTitle>
            </SheetHeader>
            <div className="grid gap-1 py-2">
              {overflowItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOverflowOpen(false)}
                  className="flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium text-foreground hover:bg-accent"
                >
                  <item.icon className="h-5 w-5 text-muted-foreground" />
                  {item.label}
                </Link>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
