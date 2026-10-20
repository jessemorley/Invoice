// Service worker: Web Push notifications + app-icon badge (Badging API), and
// an offline app shell. Navigations to "/" and the hashed /_next/static files
// are served from cache so the app launches without the network; the page is
// refreshed in the background on every launch. View data is not cached here —
// ViewSwitch keeps it in IndexedDB (src/lib/view-cache.ts). Everything else
// (/api, server actions, Supabase, /login, RSC fetches) always goes to the
// network.

const DEFAULT_ICON = "/android-chrome-192x192.png";

self.addEventListener("install", () => {
  self.skipWaiting();
});

// Registered as /sw.js?build=<commit> (push-manager.tsx); "dev" disables caching.
const BUILD = new URL(self.location.href).searchParams.get("build") || "dev";
const CACHING = BUILD !== "dev";
// The pages cache holds user-specific HTML; the login page deletes it.
const PAGES_CACHE = `pages-${BUILD}`;
const STATIC_CACHE = `static-${BUILD}`;

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(staleCaches(keys).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (!CACHING) return;
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate" && url.pathname === "/") {
    event.respondWith(servePage(event));
  } else if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(serveStatic(req));
  }
});

// Keeps the current build's caches plus the newest previous generation
// (CacheStorage lists caches in creation order). The first launch after an
// update loads the new page through the old worker, so its HTML and scripts
// sit in the previous build's caches until the next launch refills ours.
function staleCaches(keys) {
  return ["pages-", "static-"].flatMap((prefix) => {
    const current = prefix === "pages-" ? PAGES_CACHE : STATIC_CACHE;
    const older = keys.filter((k) => k.startsWith(prefix) && k !== current);
    return older.slice(0, -1);
  });
}

// Cache first per full URL (notifications open "/?view=…"), falling back to
// the previous build's copy and then any cached "/" variant; always refresh
// from the network in the background. `fresh=1` (UpdateReloader, after a
// deploy) goes to the network first so the old build isn't served again.
async function servePage(event) {
  const url = new URL(event.request.url);
  const fresh = url.searchParams.has("fresh");
  url.searchParams.delete("fresh");
  const key = url.href;
  const cache = await caches.open(PAGES_CACHE);
  const cached =
    (await cache.match(key)) ||
    (await caches.match(key)) ||
    (await cache.match(key, { ignoreSearch: true })) ||
    (await caches.match(key, { ignoreSearch: true }));
  const network = fetch(event.request).then(async (res) => {
    if (res.ok) {
      await cache.put(key, res.clone());
    } else if (res.type === "opaqueredirect") {
      // The proxy only redirects "/" to /login, so the session is gone: drop
      // the user's cached pages. The open page finds out from its own data
      // loaders (SignedOutError in view-loaders.ts) and goes to /login.
      await caches.delete(PAGES_CACHE);
    }
    return res;
  });
  if (!cached) return network;
  if (fresh) return network.catch(() => cached);
  event.waitUntil(network.catch(() => {}));
  return cached;
}

// Hashed filenames never change content, so cache first with no refresh.
async function serveStatic(req) {
  const cached = await caches.match(req); // this build's or the previous one's
  if (cached) return cached;
  const res = await fetch(req);
  if (res.ok) await (await caches.open(STATIC_CACHE)).put(req, res.clone());
  return res;
}

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
  // Note: the app-icon badge tracks the uninvoiced count, not unread
  // notifications, so it isn't cleared here — the app reconciles it on open.

  const targetUrl = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Prefer a window already showing targetUrl — just focus it.
        const match = clientList.find((c) => c.url === targetUrl && "focus" in c);
        if (match) return match.focus();
        // Otherwise navigate an existing window rather than opening a new tab.
        const any = clientList.find((c) => "focus" in c);
        if (any) {
          if ("navigate" in any) any.navigate(targetUrl).catch(() => {});
          return any.focus();
        }
        return self.clients.openWindow(targetUrl);
      })
  );
});
