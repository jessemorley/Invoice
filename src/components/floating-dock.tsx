"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LayoutDashboard, FileText, Receipt, Users, Wallet, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { view: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { view: "entries", icon: FileText, label: "Entries" },
  { view: "invoices", icon: Receipt, label: "Invoices" },
  { view: "clients", icon: Users, label: "Clients" },
  { view: "expenses", icon: Wallet, label: "Expenses" },
  { view: "settings", icon: Settings, label: "Settings" },
];

const itemClass = (isActive: boolean) =>
  cn(
    "relative flex items-center justify-center w-11 h-9 rounded-full transition-colors",
    isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
  );

const ItemInner = ({ isActive, icon: Icon }: { isActive: boolean; icon: (typeof tabs)[0]["icon"] }) => (
  <>
    {isActive && <span className="absolute inset-0 rounded-full bg-primary/10" />}
    <Icon className="size-[21px] relative" strokeWidth={isActive ? 2.25 : 1.75} />
  </>
);

export function FloatingDock() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const routerView = searchParams.get("view") ?? "entries";
  const [activeView, setActiveView] = useState(routerView);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => { setActiveView(routerView); }, [routerView]);

  useEffect(() => {
    setIsStandalone(
      "standalone" in window.navigator &&
        !!(window.navigator as { standalone: boolean }).standalone
    );
  }, []);

  const handleTap = useCallback((view: string) => {
    if (activeView === view) {
      window.dispatchEvent(new CustomEvent("dock:focus-search"));
    } else {
      setActiveView(view);
      router.replace(`/?view=${view}`, { scroll: false });
    }
  }, [activeView, router]);

  return (
    <div className="fixed left-1/2 -translate-x-1/2 z-50 md:hidden" style={{ bottom: "max(1.5rem, calc(env(safe-area-inset-bottom, 0px) + 0.5rem))" }}>
      <nav className="flex items-center gap-1 bg-background/95 backdrop-blur-md border border-border/50 rounded-full px-3 py-1.5 shadow-xl shadow-black/10">
        {tabs.map((tab) => {
          const isActive = activeView === tab.view;
          return (
            <button
              key={tab.view}
              aria-label={tab.label}
              onClick={() => handleTap(tab.view)}
              className={itemClass(isActive)}
            >
              <ItemInner isActive={isActive} icon={tab.icon} />
            </button>
          );
        })}
      </nav>
    </div>
  );
}
