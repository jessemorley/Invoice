// The proxy's login redirects only run on network requests — the offline
// shell relies on them for "/" and must not have them on /sw.js.
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { auth } = vi.hoisted(() => ({ auth: { claims: null as null | { sub: string } } }));
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getClaims: async () => ({ data: auth.claims ? { claims: auth.claims } : null }) },
  }),
}));

import { config, proxy } from "./proxy";

const req = (path: string, headers: Record<string, string> = {}) =>
  new NextRequest(new URL(path, "https://app.test"), { headers });

beforeEach(() => {
  auth.claims = null;
  vi.stubEnv("INTERNAL_API_SECRET", "s3cret");
});

describe("proxy redirects", () => {
  it("sends a logged-out user to /login", async () => {
    const res = await proxy(req("/?view=invoices"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://app.test/login");
  });

  it("lets a logged-out user reach /login", async () => {
    const res = await proxy(req("/login"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("sends a logged-in user away from /login", async () => {
    auth.claims = { sub: "u1" };
    const res = await proxy(req("/login"));
    expect(res.headers.get("location")).toBe("https://app.test/");
  });

  it("serves the app to a logged-in user, uncached by HTTP caches", async () => {
    auth.claims = { sub: "u1" };
    const res = await proxy(req("/"));
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });

  it("lets internal API calls through with the shared secret", async () => {
    const res = await proxy(req("/api/invoices/1/pdf", { authorization: "Bearer s3cret" }));
    expect(res.headers.get("location")).toBeNull();
  });
});

describe("proxy matcher", () => {
  const matches = (path: string) => config.matcher.some((m) => new RegExp(`^${m}$`).test(path));

  it("runs on the app, login and API routes", () => {
    for (const path of ["/", "/login", "/api/invoices/1/pdf", "/api/expenses/1/receipt"]) {
      expect(matches(path), path).toBe(true);
    }
  });

  it("skips the service worker, static assets, manifest, icons and webhook/job endpoints", () => {
    for (const path of ["/sw.js", "/_next/static/chunks/a.js", "/manifest.webmanifest", "/favicon.ico", "/android-chrome-192x192.png", "/api/inngest", "/api/webhooks/resend"]) {
      expect(matches(path), path).toBe(false);
    }
  });
});
