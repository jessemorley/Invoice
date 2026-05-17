"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export type ViewId = "dashboard" | "entries" | "invoices" | "clients" | "expenses" | "settings";

type ActiveViewContextValue = {
  view: ViewId;
  settingsTab: string | undefined;
  setView: (v: ViewId, opts?: { settingsTab?: string }) => void;
};

const ActiveViewContext = createContext<ActiveViewContextValue | null>(null);

export function ActiveViewProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [view, setViewState] = useState<ViewId>("entries");
  const [settingsTab, setSettingsTab] = useState<string | undefined>(undefined);

  // Seed from URL on mount — handles direct links and page refreshes.
  // Must be an effect (not lazy initializer) to avoid SSR/client hydration mismatch.
  // AppSplash hides the app until app:ready fires so there's no visible flash.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setViewState((params.get("view") as ViewId) ?? "entries");
    setSettingsTab(params.get("tab") ?? undefined);
  }, []);

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
