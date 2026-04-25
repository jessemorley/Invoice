"use client";

import { LayoutDashboard, FileText, Receipt, Users, Wallet, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

export type DockView = "dashboard" | "entries" | "invoices" | "clients" | "expenses" | "settings";

const tabs = [
  { id: "dashboard" as const, icon: LayoutDashboard, label: "Dashboard" },
  { id: "entries" as const, icon: FileText, label: "Entries" },
  { id: "invoices" as const, icon: Receipt, label: "Invoices" },
  { id: "clients" as const, icon: Users, label: "Clients" },
  { id: "expenses" as const, icon: Wallet, label: "Expenses" },
  { id: "settings" as const, icon: Settings, label: "Settings" },
];

type Props = {
  activeView: DockView;
  onViewChange: (view: DockView) => void;
};

export function FloatingDock({ activeView, onViewChange }: Props) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <nav className="flex items-center gap-0.5 bg-background/95 backdrop-blur-md border border-border/50 rounded-full px-2.5 py-2 shadow-xl shadow-black/10">
        {tabs.map((tab) => {
          const isActive = activeView === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onViewChange(tab.id)}
              aria-label={tab.label}
              className={cn(
                "relative flex items-center justify-center w-11 h-11 rounded-full transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {isActive && (
                <span className="absolute inset-0 rounded-full bg-primary/10" />
              )}
              <tab.icon
                className="size-[21px] relative"
                strokeWidth={isActive ? 2.25 : 1.75}
              />
            </button>
          );
        })}
      </nav>
    </div>
  );
}
