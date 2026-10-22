"use client";

import { useEffect } from "react";

// Sheets, drawers and dialogs are all Radix: open ones carry these roles.
function formOpen() {
  return document.querySelector('[role="dialog"], [role="alertdialog"]') !== null;
}

/**
 * After a deploy, a page served from the service worker's cache is still the
 * old build, and its server-action IDs no longer exist on the server. This
 * compares the running build with the deployed one (on launch, resume and
 * reconnect) and reloads into the new build at a safe moment: straight away
 * if nothing is open, otherwise the next time the app goes to the
 * background with nothing open. `fresh=1` makes the worker fetch the page
 * from the network instead of serving the cached old build again.
 */
export function UpdateReloader() {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has("fresh")) {
      url.searchParams.delete("fresh");
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    }

    const build = process.env.NEXT_PUBLIC_BUILD_ID;
    if (!build || build === "dev") return;
    let pending = false;

    function reloadIfSafe() {
      if (!pending || formOpen()) return;
      const next = new URL(window.location.href);
      next.searchParams.set("fresh", "1");
      window.location.replace(next.pathname + next.search);
    }

    async function check() {
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        const { build: deployed } = await res.json();
        if (deployed && deployed !== build) pending = true;
      } catch {
        return; // offline or logged out: try again on the next trigger
      }
      reloadIfSafe();
    }

    function onVisibility() {
      if (document.visibilityState === "hidden") reloadIfSafe();
      else check();
    }

    check();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", check);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", check);
    };
  }, []);

  return null;
}
