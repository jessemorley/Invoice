// Runs the real public/sw.js against stubbed worker globals to pin down which
// requests the offline shell may cache — user data must never land in it.
import { describe, expect, it, vi } from "vitest";
import { loadSw, res, ORIGIN } from "@/test/sw-harness";

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

describe("sw.js lifecycle", () => {
  it("activates immediately and takes control of open pages", async () => {
    const sw = loadSw();
    await sw.fire("install");
    expect(sw.self.skipWaiting).toHaveBeenCalled();
    await sw.fire("activate");
    expect(sw.self.clients.claim).toHaveBeenCalled();
  });

  it("prunes old builds' caches on activate, keeping the current build and unrelated caches", async () => {
    const sw = loadSw("new");
    for (const name of ["pages-oldest", "static-oldest", "pages-old", "static-old", "pages-new", "static-new", "someone-else"]) sw.store.set(name, new Map());
    await sw.fire("activate");
    const left = [...sw.store.keys()];
    expect(left).toEqual(expect.arrayContaining(["pages-new", "static-new", "someone-else"]));
    expect(left).not.toContain("pages-oldest");
    expect(left).not.toContain("static-oldest");
  });
});

// Regression: phase 3 must not change push or badge behaviour. iOS cancels
// the subscription if a push arrives without a visible notification.
describe("sw.js push and badge (unchanged)", () => {
  const push = (data: unknown) => ({ data: data === undefined ? null : typeof data === "string"
    ? { json: () => JSON.parse(data), text: () => data }
    : { json: () => data, text: () => JSON.stringify(data) } });

  it("always shows a notification, with the payload's title, body and url", async () => {
    const sw = loadSw();
    await sw.fire("push", push({ title: "Invoice sent", body: "INV-1", url: "/?view=invoices", tag: "t" }));
    expect(sw.self.registration.showNotification).toHaveBeenCalledWith("Invoice sent", expect.objectContaining({ body: "INV-1", tag: "t", data: { url: "/?view=invoices" } }));
  });

  it("still shows a notification for a non-JSON payload", async () => {
    const sw = loadSw();
    await sw.fire("push", { data: { json: () => { throw new SyntaxError("bad"); }, text: () => "plain text" } });
    expect(sw.self.registration.showNotification).toHaveBeenCalledWith("Invoicing", expect.objectContaining({ body: "plain text" }));
  });

  it("still shows a notification for an empty push", async () => {
    const sw = loadSw();
    await sw.fire("push", push(undefined));
    expect(sw.self.registration.showNotification).toHaveBeenCalledTimes(1);
  });

  it("sets or clears the app-icon badge from badgeCount", async () => {
    const sw = loadSw();
    await sw.fire("push", push({ badgeCount: 4 }));
    expect(sw.self.navigator.setAppBadge).toHaveBeenCalledWith(4);
    await sw.fire("push", push({ badgeCount: 0 }));
    expect(sw.self.navigator.clearAppBadge).toHaveBeenCalledTimes(1);
  });

  it("focuses a window already on the target url when a notification is tapped", async () => {
    const sw = loadSw();
    const win = { url: "/?view=invoices", focus: vi.fn(), navigate: vi.fn(async () => {}) };
    sw.windows.push(win);
    const notification = { close: vi.fn(), data: { url: "/?view=invoices" } };
    await sw.fire("notificationclick", { notification });
    expect(notification.close).toHaveBeenCalled();
    expect(win.focus).toHaveBeenCalled();
    expect(win.navigate).not.toHaveBeenCalled();
  });

  it("navigates an existing window, or opens one, for the tapped notification's url", async () => {
    const sw = loadSw();
    const win = { url: "/", focus: vi.fn(), navigate: vi.fn(async () => {}) };
    sw.windows.push(win);
    await sw.fire("notificationclick", { notification: { close: vi.fn(), data: { url: "/?view=emails" } } });
    expect(win.navigate).toHaveBeenCalledWith("/?view=emails");
    expect(win.focus).toHaveBeenCalled();

    const empty = loadSw();
    await empty.fire("notificationclick", { notification: { close: vi.fn(), data: { url: "/?view=emails" } } });
    expect(empty.self.clients.openWindow).toHaveBeenCalledWith("/?view=emails");
  });
});
