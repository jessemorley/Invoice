"use client";

import { useEffect } from "react";

/**
 * Registers the push service worker and clears the app-icon badge whenever the
 * app becomes visible (i.e. the user has opened/focused the PWA). Mounted once
 * in the authed app layout.
 */
export function PushManager() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    function clearBadge() {
      if (document.visibilityState !== "visible") return;
      if ("clearAppBadge" in navigator) {
        (navigator as Navigator & { clearAppBadge: () => Promise<void> })
          .clearAppBadge()
          .catch(() => {});
      }
    }

    clearBadge();
    document.addEventListener("visibilitychange", clearBadge);
    return () => document.removeEventListener("visibilitychange", clearBadge);
  }, []);

  return null;
}
