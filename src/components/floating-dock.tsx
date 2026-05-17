"use client";

import { useCallback } from "react";
import { LayoutDashboard, FileText, Receipt, Users, Wallet, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useActiveView, type ViewId } from "@/components/active-view-context";

const tabs: { view: ViewId; icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; label: string }[] = [
  { view: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { view: "entries", icon: FileText, label: "Entries" },
  { view: "invoices", icon: Receipt, label: "Invoices" },
  { view: "clients", icon: Users, label: "Clients" },
  { view: "expenses", icon: Wallet, label: "Expenses" },
  { view: "settings", icon: Settings, label: "Settings" },
];

const itemClass = (isActive: boolean) =>
  cn(
    "relative flex items-center justify-center w-14 h-11 rounded-full transition-colors touch-manipulation",
    isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
  );

const ItemInner = ({ isActive, icon: Icon }: { isActive: boolean; icon: (typeof tabs)[0]["icon"] }) => (
  <>
    {isActive && <span className="absolute inset-0 rounded-full bg-primary/10" />}
    <Icon className="size-[23px] relative" strokeWidth={isActive ? 2.25 : 1.75} />
  </>
);

export function FloatingDock() {
  const { view, setView } = useActiveView();

  const handleTap = useCallback((tab: ViewId) => {
    if (view === tab) {
      window.dispatchEvent(new CustomEvent("dock:focus-search"));
    } else {
      setView(tab);
    }
  }, [view, setView]);

  return (
    <div className="fixed left-1/2 -translate-x-1/2 z-50 md:hidden" style={{ bottom: "env(safe-area-inset-bottom, 0px)" }}>
      <nav className="flex items-center gap-0.5 bg-background/95 backdrop-blur-md border border-border/50 rounded-full px-1.5 py-1 shadow-xl shadow-black/10">
        {tabs.map((tab) => {
          const isActive = view === tab.view;
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
