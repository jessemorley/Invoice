// Runs the real public/sw.js against stubbed worker globals (self, caches,
// fetch) in a vm context. Caches are Maps in creation order, like CacheStorage.
import { readFileSync } from "fs";
import { resolve } from "path";
import vm from "vm";
import { vi } from "vitest";

export const SRC = readFileSync(resolve(__dirname, "../../public/sw.js"), "utf8");
export const ORIGIN = "https://app.test";

export type Res = { ok: boolean; type: string; body: string; clone(): Res };
export const res = (body: string, ok = true, type = "basic"): Res => ({ ok, type, body, clone() { return this; } });

export function loadSw(build: string | null = "abc123") {
  const listeners: Record<string, (e: unknown) => void> = {};
  const store = new Map<string, Map<string, Res>>();
  const key = (url: string, ignoreSearch?: boolean) => (ignoreSearch ? url.split("?")[0] : url);
  // Cache APIs take a Request or a URL string.
  const urlOf = (req: { url: string } | string) => (typeof req === "string" ? req : req.url);
  const caches = {
    open: async (name: string) => {
      if (!store.has(name)) store.set(name, new Map());
      const c = store.get(name)!;
      return {
        match: async (req: { url: string } | string, opts?: { ignoreSearch?: boolean }) => {
          if (!opts?.ignoreSearch) return c.get(urlOf(req));
          for (const [url, r] of c) if (key(url, true) === key(urlOf(req), true)) return r;
        },
        put: async (req: { url: string } | string, r: Res) => void c.set(urlOf(req), r),
      };
    },
    // CacheStorage.match: searches every cache, oldest first.
    match: async (req: { url: string } | string, opts?: { ignoreSearch?: boolean }) => {
      for (const c of store.values()) {
        if (!opts?.ignoreSearch && c.has(urlOf(req))) return c.get(urlOf(req));
        if (opts?.ignoreSearch) for (const [url, r] of c) if (key(url, true) === key(urlOf(req), true)) return r;
      }
    },
    delete: async (name: string) => store.delete(name),
    keys: async () => [...store.keys()],
  };
  const windows: { url: string; focus: ReturnType<typeof vi.fn>; navigate: ReturnType<typeof vi.fn> }[] = [];
  const self = {
    location: { href: `${ORIGIN}/sw.js${build ? `?build=${build}` : ""}`, origin: ORIGIN },
    addEventListener: (type: string, fn: (e: unknown) => void) => (listeners[type] = fn),
    clients: { claim: vi.fn(async () => {}), matchAll: async () => windows, openWindow: vi.fn(async () => {}) },
    registration: { showNotification: vi.fn(async () => {}) },
    skipWaiting: vi.fn(),
    navigator: { setAppBadge: vi.fn(async () => {}), clearAppBadge: vi.fn(async () => {}) },
  };
  const fetch = vi.fn(async () => res("network"));
  vm.runInNewContext(SRC, { self, caches, fetch, URL, Promise, console });

  async function request(path: string, init: { method?: string; mode?: string } = {}) {
    const url = path.startsWith("http") ? path : ORIGIN + path;
    let response: Promise<Res> | undefined;
    const waits: Promise<unknown>[] = [];
    listeners.fetch({
      request: { url, method: init.method ?? "GET", mode: init.mode ?? "cors" },
      respondWith: (p: Promise<Res>) => (response = p),
      waitUntil: (p: Promise<unknown>) => waits.push(p),
    });
    const out = response && (await response);
    await Promise.all(waits);
    return out;
  }
  // Fire a lifecycle/push event and wait for everything it passed to waitUntil.
  async function fire(type: string, extra: object = {}) {
    const waits: Promise<unknown>[] = [];
    listeners[type]({ waitUntil: (p: Promise<unknown>) => waits.push(p), ...extra });
    await Promise.all(waits);
  }
  return { request, fetch, store, fire, self, windows };
}

