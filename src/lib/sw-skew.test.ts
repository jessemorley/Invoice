// Offline-first launch, phase 4 (version skew), service-worker side.
// Written ahead of the implementation as its acceptance spec.
import { describe, expect, it } from "vitest";
import { loadSw, res, ORIGIN } from "@/test/sw-harness";

describe("sw.js after a deploy", () => {
  it("fetches a ?fresh=1 navigation from the network first, even with a cached copy", async () => {
    const sw = loadSw("abc");
    await sw.request("/?view=tax", { mode: "navigate" }); // caches "old"
    sw.fetch.mockResolvedValueOnce(res("new build"));
    expect((await sw.request("/?view=tax&fresh=1", { mode: "navigate" }))!.body).toBe("new build");
  });

  it("stores the fresh page under the URL without the fresh flag", async () => {
    const sw = loadSw("abc");
    sw.fetch.mockResolvedValueOnce(res("new build"));
    await sw.request("/?view=tax&fresh=1", { mode: "navigate" });
    const pages = sw.store.get("pages-abc")!;
    expect(pages.get(ORIGIN + "/?view=tax")!.body).toBe("new build");
    expect([...pages.keys()].some((u) => u.includes("fresh"))).toBe(false);
  });

  it("falls back to the cached page for a ?fresh=1 navigation when offline", async () => {
    const sw = loadSw("abc");
    await sw.request("/", { mode: "navigate" });
    sw.fetch.mockRejectedValue(new TypeError("offline"));
    expect((await sw.request("/?fresh=1", { mode: "navigate" }))!.body).toBe("network");
  });

  it("keeps the previous build's caches on activate, so the first launch after an update works offline", async () => {
    const sw = loadSw("new");
    for (const name of ["pages-oldest", "static-oldest", "pages-old", "static-old"]) sw.store.set(name, new Map());
    await sw.fire("activate");
    expect([...sw.store.keys()].sort()).toEqual(["pages-old", "static-old"]);
  });

  it("serves a script cached under the previous build without going to the network", async () => {
    const sw = loadSw("new");
    sw.store.set("static-old", new Map([[ORIGIN + "/_next/static/chunks/app-123.js", res("cached js")]]));
    expect((await sw.request("/_next/static/chunks/app-123.js"))!.body).toBe("cached js");
    expect(sw.fetch).not.toHaveBeenCalled();
  });

  it("serves a page cached under the previous build when offline", async () => {
    const sw = loadSw("new");
    sw.store.set("pages-old", new Map([[ORIGIN + "/", res("page from previous build")]]));
    sw.fetch.mockRejectedValue(new TypeError("offline"));
    expect((await sw.request("/", { mode: "navigate" }))!.body).toBe("page from previous build");
  });

  it("prefers the current build's page over the previous build's", async () => {
    const sw = loadSw("new");
    sw.store.set("pages-old", new Map([[ORIGIN + "/", res("old page")]]));
    sw.store.set("pages-new", new Map([[ORIGIN + "/", res("new page")]]));
    sw.fetch.mockRejectedValue(new TypeError("offline"));
    expect((await sw.request("/", { mode: "navigate" }))!.body).toBe("new page");
  });

  it("prefers the current build's / over the previous build's exact view URL", async () => {
    const sw = loadSw("new");
    sw.store.set("pages-old", new Map([[ORIGIN + "/?view=entries", res("old page")]]));
    sw.store.set("pages-new", new Map([[ORIGIN + "/", res("new page")]]));
    sw.fetch.mockRejectedValue(new TypeError("offline"));
    expect((await sw.request("/?view=entries", { mode: "navigate" }))!.body).toBe("new page");
  });

  it("drops the previous build's cached pages too when redirected to /login", async () => {
    const sw = loadSw("new");
    sw.store.set("pages-old", new Map([[ORIGIN + "/", res("signed-in page")]]));
    sw.fetch.mockResolvedValueOnce(res("", false, "opaqueredirect"));
    await sw.request("/", { mode: "navigate" });
    expect([...sw.store.keys()].filter((k) => k.startsWith("pages-"))).toEqual([]);
  });

  it("copies a script served from the previous build's cache into this build's, so the next activate can't strand it", async () => {
    const sw = loadSw("new");
    const url = ORIGIN + "/_next/static/chunks/app-123.js";
    sw.store.set("static-old", new Map([[url, res("cached js")]]));
    await sw.request("/_next/static/chunks/app-123.js");
    expect(sw.store.get("static-new")?.get(url)?.body).toBe("cached js");
  });
});
