"use client";

import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { savePushSubscription, deletePushSubscription } from "@/app/(app)/settings/actions";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

type Status = "loading" | "unsupported" | "needs-install" | "default" | "granted" | "denied";

export function PushNotificationToggle() {
  const [status, setStatus] = useState<Status>("loading");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supported =
      "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    if (!supported) {
      setStatus("unsupported");
      return;
    }

    // On iOS, push only works once the PWA is installed to the home screen.
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && (navigator as { standalone?: boolean }).standalone === true);
    if (isIOS && !isStandalone) {
      setStatus("needs-install");
      return;
    }

    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }

    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setStatus(sub ? "granted" : "default"))
      .catch(() => setStatus("default"));
  }, []);

  async function enable() {
    setError(null);
    setPending(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "default");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
if (!key) throw new Error("Push is not configured (missing VAPID key).");
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
        }));
      const json = sub.toJSON();
      if (!json.keys?.p256dh || !json.keys?.auth) {
        throw new Error("Push subscription is missing encryption keys.");
      }
      await savePushSubscription({
        endpoint: sub.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        user_agent: navigator.userAgent,
      });
      setStatus("granted");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not enable notifications.");
    } finally {
      setPending(false);
    }
  }

  async function disable() {
    setError(null);
    setPending(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        await deletePushSubscription(sub.endpoint);
      }
      setStatus("default");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not disable notifications.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="push_notifications" className="text-sm font-medium">
            Push notifications
          </label>
          <p className="text-sm text-muted-foreground">
            {status === "unsupported"
              ? "This browser does not support push notifications."
              : status === "needs-install"
                ? "Add this app to your home screen first, then open it to enable notifications."
                : status === "denied"
                  ? "Notifications are blocked — enable them in your browser settings."
                  : "Get notified on this device when invoices are sent and when work is ready to bill."}
          </p>
        </div>
        <Switch
          id="push_notifications"
          checked={status === "granted"}
          disabled={
            pending ||
            status === "loading" ||
            status === "unsupported" ||
            status === "needs-install" ||
            status === "denied"
          }
          onCheckedChange={(v) => (v ? enable() : disable())}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
