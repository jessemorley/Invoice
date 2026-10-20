// Runs the real public/sw.js against stubbed worker globals to pin down which
// requests the offline shell may cache — user data must never land in it.
import { readFileSync } from "fs";
import { resolve } from "path";
import vm from "vm";
import { describe, expect, it, vi } from "vitest";

const SRC = readFileSync(resolve(__dirname, "../../public/sw.js"), "utf8");
const ORIGIN = "https://app.test";

type Res = { ok: boolean; type: string; body: string; clone(): Res };
const res = (body: string, ok = true, type = "basic"): Res => ({ ok, type, body, clone() { return this; } });

function loadSw(build: string | null = "abc123") {
  const listeners: Record<string, (e: unknown) => void> = {};
  const store = new Map<string, Map<string, Res>>();
  const key = (url: string, ignoreSearch?: boolean) => (ignoreSearch ? url.split("?")[0] : url);
  const caches = {
    open: async (name: string) => {
      if (!store.has(name)) store.set(name, new Map());
      const c = store.get(name)!;
      return {
        match: async (req: { url: string }, opts?: { ignoreSearch?: boolean }) => {
          if (!opts?.ignoreSearch) return c.get(req.url);
          for (const [url, r] of c) if (key(url, true) === key(req.url, true)) return r;
        },
        put: async (req: { url: string }, r: Res) => void c.set(req.url, r),
      };
    },
    delete: async (name: string) => store.delete(name),
    keys: async () => [...store.keys()],
  };
  const self = {
    location: { href: `${ORIGIN}/sw.js${build ? `?build=${build}` : ""}`, origin: ORIGIN },
    addEventListener: (type: string, fn: (e: unknown) => void) => (listeners[type] = fn),
    clients: { claim: async () => {}, matchAll: async () => [] },
    registration: {},
    skipWaiting: () => {},
    navigator: {},
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
  return { request, fetch, store };
}

describe("sw.js fetch handler", () => {
  it("handles navigations to / (any view) and hashed static files", async () => {
    const sw = loadSw();
    expect(await sw.request("/", { mode: "navigate" })).toBeDefined();
    expect(await sw.request("/?view=invoices", { mode: "navigate" })).toBeDefined();
    expect(await sw.request("/_next/static/chunks/app.js")).toBeDefined();
  });

  it("never touches API, server actions, RSC fetches, Supabase, login or the worker itself", async () => {
    const sw = loadSw();
    for (const [path, init] of [
      ["/api/invoices/1/pdf", {}],
      ["/", { method: "POST" }], // server action
      ["/?_rsc=abc", {}], // RSC fetch: not a navigation
      ["https://xyz.supabase.co/rest/v1/entries", {}],
      ["/login", { mode: "navigate" }],
      ["/sw.js", {}],
    ] as const) {
      expect(await sw.request(path, init), path).toBeUndefined();
    }
  });

  it("caches nothing in dev builds", async () => {
    const sw = loadSw(null);
    expect(await sw.request("/", { mode: "navigate" })).toBeUndefined();
    expect(await sw.request("/_next/static/chunks/app.js")).toBeUndefined();
  });

  it("serves the cached page first and refreshes it in the background", async () => {
    const sw = loadSw();
    expect((await sw.request("/", { mode: "navigate" }))!.body).toBe("network");
    sw.fetch.mockResolvedValueOnce(res("newer"));
    expect((await sw.request("/", { mode: "navigate" }))!.body).toBe("network");
    expect(sw.store.get("pages-abc123")!.get(ORIGIN + "/")!.body).toBe("newer");
  });

  it("falls back to any cached / variant for an unseen view URL", async () => {
    const sw = loadSw();
    await sw.request("/", { mode: "navigate" });
    sw.fetch.mockRejectedValue(new TypeError("offline"));
    expect((await sw.request("/?view=tax", { mode: "navigate" }))!.body).toBe("network");
  });

  it("drops cached pages when the background refresh is redirected to /login", async () => {
    const sw = loadSw();
    await sw.request("/", { mode: "navigate" });
    sw.fetch.mockResolvedValueOnce(res("", false, "opaqueredirect"));
    await sw.request("/", { mode: "navigate" });
    expect(sw.store.has("pages-abc123")).toBe(false);
  });

  it("never caches a redirect or error response", async () => {
    const sw = loadSw();
    sw.fetch.mockResolvedValueOnce(res("", false, "opaqueredirect"));
    await sw.request("/", { mode: "navigate" });
    sw.fetch.mockResolvedValueOnce(res("err", false));
    await sw.request("/_next/static/chunks/missing.js");
    expect([...(sw.store.get("pages-abc123")?.values() ?? [])]).toEqual([]);
    expect([...(sw.store.get("static-abc123")?.values() ?? [])]).toEqual([]);
  });
});
