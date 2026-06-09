"use client";

import { useEffect } from "react";

/**
 * Registers the push service worker and keeps the app-icon badge (Badging API)
 * in sync with the uninvoiced count — the same value ViewSwitch broadcasts to
 * the in-app dock badge via the "dock:uninvoiced-count" event. This way the icon
 * badge tracks billable work for every cutoff (including "immediately", which
 * never sends a push), and a weekly-reminder push that set the badge while the
 * app was closed gets reconciled to the real count once data loads. Mounted once
 * in the authed app layout.
 */
export function PushManager() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    if (!("setAppBadge" in navigator)) return;
    const nav = navigator as Navigator & {
      setAppBadge: (count?: number) => Promise<void>;
      clearAppBadge: () => Promise<void>;
    };

    function handler(e: Event) {
      const count = (e as CustomEvent<number>).detail ?? 0;
      (count > 0 ? nav.setAppBadge(count) : nav.clearAppBadge()).catch(() => {});
    }

    window.addEventListener("dock:uninvoiced-count", handler);
    return () => window.removeEventListener("dock:uninvoiced-count", handler);
  }, []);

  return null;
}
