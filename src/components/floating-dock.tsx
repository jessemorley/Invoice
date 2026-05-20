"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LayoutDashboard, FileText, Receipt, Users, Wallet, Settings, Plus, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useActiveView, type ViewId } from "@/components/active-view-context";

const PRIMARY_TABS: { view: ViewId; icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; label: string }[] = [
  { view: "entries", icon: FileText, label: "Entries" },
  { view: "invoices", icon: Receipt, label: "Invoices" },
];

const SECONDARY_TABS: { view: ViewId; icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; label: string }[] = [
  { view: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { view: "clients", icon: Users, label: "Clients" },
  { view: "expenses", icon: Wallet, label: "Expenses" },
  { view: "settings", icon: Settings, label: "Settings" },
];

const PRIMARY_VIEWS = new Set<ViewId>(["entries", "invoices", "expenses"]);

export function FloatingDock() {
  const { view, setView } = useActiveView();
  const [menuOpen, setMenuOpen] = useState(false);
  const innerRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const [pillStyle, setPillStyle] = useState({ x: 0, w: 46 });
  const [uninvoicedCount, setUninvoicedCount] = useState(0);

  useEffect(() => {
    const handler = (e: Event) => setUninvoicedCount((e as CustomEvent<number>).detail);
    window.addEventListener("dock:uninvoiced-count", handler);
    return () => window.removeEventListener("dock:uninvoiced-count", handler);
  }, []);

  // Measure active primary tab position for the sliding pill
  useEffect(() => {
    const activeIndex = PRIMARY_TABS.findIndex((t) => t.view === view);
    if (activeIndex === -1) return;
    const id = requestAnimationFrame(() => {
      const inner = innerRef.current;
      const container = tabsRef.current;
      if (!inner || !container) return;
      const el = container.children[activeIndex] as HTMLElement | undefined;
      if (!el) return;
      const innerRect = inner.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      setPillStyle({ x: elRect.left - innerRect.left, w: elRect.width });
    });
    return () => cancelAnimationFrame(id);
  }, [view]);

  const handlePrimaryTap = useCallback(
    (tab: ViewId) => {
      if (view === tab) {
        if (tab === "invoices") {
          window.dispatchEvent(new CustomEvent("dock:focus-search"));
        }
      } else {
        setView(tab);
      }
    },
    [view, setView]
  );

  const handleSecondaryTap = useCallback(
    (tab: ViewId) => {
      setView(tab);
      setMenuOpen(false);
    },
    [setView]
  );

  return (
    <>
      {/* Backdrop — full screen, click to close */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
          data-testid="menu-overlay"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Dock */}
      <div className="fixed left-1/2 -translate-x-1/2 z-50 md:hidden" style={{ bottom: "max(env(safe-area-inset-bottom, 0px), 1.5rem)" }}>

        {/* Popover — positioned above the dock, centered on it */}
        {menuOpen && (
          <div
            className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-[calc(100vw-2rem)] max-w-sm bg-background border border-border/50 rounded-xl shadow-lg overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-1">
              {SECONDARY_TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.view}
                    aria-label={tab.label}
                    onClick={() => handleSecondaryTap(tab.view)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted rounded-md transition-colors duration-200 touch-manipulation"
                  >
                    <Icon className="size-[18px] text-muted-foreground" strokeWidth={1.75} />
                    <span className="font-medium">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <nav className="bg-background/95 backdrop-blur-md border border-border/50 rounded-full px-2 py-2 shadow-xl shadow-black/10">
          {/* Inner wrapper — pill is positioned relative to this */}
          <div ref={innerRef} className="relative flex items-center gap-1">

            {/* Sliding pill — hidden on secondary views */}
            <div
              className={cn(
                "absolute inset-y-0 bg-muted rounded-full transition-[left,width] duration-150 ease-in-out pointer-events-none",
                !PRIMARY_TABS.some((t) => t.view === view) && "hidden"
              )}
              style={{ left: pillStyle.x, width: pillStyle.w }}
            />

            {/* Plus button — active for primary views, greyed out otherwise */}
            <button
              aria-label="New"
              disabled={!PRIMARY_VIEWS.has(view)}
              onClick={() => window.dispatchEvent(new CustomEvent("dock:new", { detail: view }))}
              className={cn(
                "relative z-10 flex items-center justify-center p-3 rounded-full transition-colors duration-150 touch-manipulation",
                PRIMARY_VIEWS.has(view) ? "text-primary" : "text-muted-foreground/30 cursor-default"
              )}
            >
              <Plus className="size-6" strokeWidth={1.75} />
            </button>

            {/* Divider */}
            <div className="relative z-10 w-px h-6 bg-border" />

            {/* Primary tabs */}
            <div ref={tabsRef} className="flex items-center">
              {PRIMARY_TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = view === tab.view;
                return (
                  <button
                    key={tab.view}
                    aria-label={tab.label}
                    onClick={() => handlePrimaryTap(tab.view)}
                    className={cn(
                      "relative z-10 flex items-center justify-center p-3 rounded-full transition-colors duration-150 touch-manipulation",
                      isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Icon className="size-6 relative" strokeWidth={isActive ? 2.25 : 1.75} />
                    {/* Badge on invoices tab */}
                    {tab.view === "invoices" && uninvoicedCount > 0 && (
                      <span className="absolute top-1.5 right-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground leading-none">
                        {uninvoicedCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Divider */}
            <div className="relative z-10 w-px h-6 bg-border" />

            {/* Menu button — active when on a secondary view */}
            <button
              aria-label="Menu"
              onClick={() => setMenuOpen((o) => !o)}
              className="relative z-10 flex items-center justify-center p-3 rounded-full text-muted-foreground hover:text-foreground transition-colors duration-150 touch-manipulation"
            >
              {menuOpen
                ? <X className="size-6" strokeWidth={1.75} />
                : <Menu className="size-6" strokeWidth={1.75} />}
            </button>

          </div>
        </nav>
      </div>
    </>
  );
}
