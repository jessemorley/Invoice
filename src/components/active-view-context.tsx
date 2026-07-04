"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export type ViewId = "dashboard" | "entries" | "invoices" | "clients" | "expenses" | "tax" | "settings";

type ActiveViewContextValue = {
  view: ViewId;
  settingsTab: string | undefined;
  setView: (v: ViewId, opts?: { settingsTab?: string }) => void;
};

const ActiveViewContext = createContext<ActiveViewContextValue | null>(null);

export function ActiveViewProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
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
      router.replace(url, { scroll: false });
    },
    [router]
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
