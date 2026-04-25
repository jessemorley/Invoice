"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FileText, Receipt, Users, Wallet, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/entries", icon: FileText, label: "Entries" },
  { href: "/invoices", icon: Receipt, label: "Invoices" },
  { href: "/clients", icon: Users, label: "Clients" },
  { href: "/expenses", icon: Wallet, label: "Expenses" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

function DockItem({ href, icon: Icon, label, pathname }: (typeof tabs)[0] & { pathname: string }) {
  const { pending } = useLinkStatus();
  const isActive = pending || pathname.startsWith(href);

  return (
    <Link
      href={href}
      aria-label={label}
      onClick={(e) => {
        if (isActive) {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent("dock:focus-search"));
        }
      }}
      className={cn(
        "relative flex items-center justify-center w-11 h-11 rounded-full transition-colors",
        isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {isActive && <span className="absolute inset-0 rounded-full bg-primary/10" />}
      <Icon className="size-[21px] relative" strokeWidth={isActive ? 2.25 : 1.75} />
    </Link>
  );
}

export function FloatingDock() {
  const pathname = usePathname();

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 md:hidden">
      <nav className="flex items-center gap-0.5 bg-background/95 backdrop-blur-md border border-border/50 rounded-full px-2.5 py-2 shadow-xl shadow-black/10">
        {tabs.map((tab) => (
          <DockItem key={tab.href} {...tab} pathname={pathname} />
        ))}
      </nav>
    </div>
  );
}
