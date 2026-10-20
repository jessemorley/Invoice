// Offline-first launch, phase 4: the app compares its own build with the
// deployed one. Written ahead of the implementation as its acceptance spec.
import { afterEach, expect, it, vi } from "vitest";

afterEach(() => vi.unstubAllEnvs());

it("returns the deployed build ID, never cached", async () => {
  vi.stubEnv("NEXT_PUBLIC_BUILD_ID", "abc123");
  const { GET } = await import("./route");
  const res = await GET();
  expect(await res.json()).toEqual({ build: "abc123" });
  expect(res.headers.get("cache-control")).toContain("no-store");
});
