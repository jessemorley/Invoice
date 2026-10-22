"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LayoutDashboard, FileClock, Receipt, Mail, Users, Wallet, Landmark, Settings } from "lucide-react";

// Every view, in nav order. ViewId is derived from this, so a new view can't
// miss the dock or the sidebar. `primary` views sit in the dock; the rest are in its menu.
export const VIEWS = [
  { view: "dashboard", label: "Dashboard", icon: LayoutDashboard, primary: true },
  { view: "entries", label: "Entries", icon: FileClock, primary: true },
  { view: "invoices", label: "Invoices", icon: Receipt, primary: true },
  { view: "emails", label: "Emails", icon: Mail, primary: false },
  { view: "clients", label: "Clients", icon: Users, primary: false },
  { view: "expenses", label: "Expenses", icon: Wallet, primary: false },
  { view: "tax", label: "Tax", icon: Landmark, primary: false },
  { view: "settings", label: "Settings", icon: Settings, primary: false },
] as const;

export type ViewId = (typeof VIEWS)[number]["view"];

type ActiveViewContextValue = {
  view: ViewId;
  settingsTab: string | undefined;
  setView: (v: ViewId, opts?: { settingsTab?: string }) => void;
};

const ActiveViewContext = createContext<ActiveViewContextValue | null>(null);

export function ActiveViewProvider({ children }: { children: React.ReactNode }) {
  // useSearchParams is server-safe and returns the request URL's params during
  // SSR, so seeding state from it in a lazy initializer keeps server and client
  // initial renders identical — no hydration mismatch on data-active.
  const searchParams = useSearchParams();
  const [view, setViewState] = useState<ViewId>(
    () => (searchParams.get("view") as ViewId) ?? "entries"
  );
  const [settingsTab, setSettingsTab] = useState<string | undefined>(
    () => searchParams.get("tab") ?? undefined
  );

  const setView = useCallback(
    (v: ViewId, opts?: { settingsTab?: string }) => {
      setViewState(v);
      setSettingsTab(opts?.settingsTab);
      const url = opts?.settingsTab ? `/?view=${v}&tab=${opts.settingsTab}` : `/?view=${v}`;
      // Native history, not router.replace: Next keeps useSearchParams in sync
      // without fetching the route from the server, so tab switches work offline.
      window.history.replaceState(null, "", url);
    },
    []
  );

  return (
    <ActiveViewContext.Provider value={{ view, settingsTab, setView }}>
      {children}
    </ActiveViewContext.Provider>
  );
}

export function useActiveView() {
  const ctx = useContext(ActiveViewContext);
  if (!ctx) throw new Error("useActiveView must be used inside ActiveViewProvider");
  return ctx;
}
