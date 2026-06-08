// Service worker for Web Push notifications + app-icon badge (Badging API).
// Intentionally has no fetch/offline caching — this app is an authed SPA and
// caching responses would serve stale, user-specific data.

const DEFAULT_ICON = "/android-chrome-192x192.png";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // iOS can deliver non-JSON payloads — fall back to plain text.
    data = { title: "Invoicing", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Invoicing";
  const options = {
    body: data.body || "",
    icon: data.icon || DEFAULT_ICON,
    badge: data.badge || DEFAULT_ICON,
    tag: data.tag,
    data: { url: data.url || "/" },
  };

  const badgeCount = typeof data.badgeCount === "number" ? data.badgeCount : null;
  let badgePromise = Promise.resolve();
  if (badgeCount != null && self.navigator && self.navigator.setAppBadge) {
    badgePromise =
      badgeCount > 0
        ? self.navigator.setAppBadge(badgeCount)
        : self.navigator.clearAppBadge();
  }

  // MANDATORY: iOS cancels the push subscription if a push arrives without a
  // visible notification, so always showNotification inside waitUntil.
  event.waitUntil(
    Promise.all([self.registration.showNotification(title, options), badgePromise])
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (self.navigator && self.navigator.clearAppBadge) {
    self.navigator.clearAppBadge().catch(() => {});
  }

  const targetUrl = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            if ("navigate" in client) client.navigate(targetUrl).catch(() => {});
            return client.focus();
          }
        }
        return self.clients.openWindow(targetUrl);
      })
  );
});
