"use client";

import { useEffect } from "react";
import { savePushSubscription } from "@/app/(app)/settings/actions";

/**
 * Re-asserts the push subscription server-side on app launch. The browser's
 * subscription outlives the database row, so a user who is pushed to less
 * often than the 90-day prune window would otherwise have a live device
 * silently dropped from push_subscriptions. This restores the row if it was
 * already pruned and resets the TTL clock if it wasn't.
 *
 * Best-effort and fire-and-forget: failures here must never surface to the
 * user or block the app. Only re-asserts an existing subscription — it never
 * prompts for permission, so a user who has not opted in is unaffected.
 */
function refreshPushSubscription() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  navigator.serviceWorker.ready
    .then((reg) => reg.pushManager.getSubscription())
    .then((sub) => {
      if (!sub) return;
      const json = sub.toJSON();
      if (!json.keys?.p256dh || !json.keys?.auth) return;
      return savePushSubscription({
        endpoint: sub.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        user_agent: navigator.userAgent,
      });
    })
    .catch(() => {});
}

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
      refreshPushSubscription();
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
