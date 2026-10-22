// Phase 3: the service worker caches the HTML for "/", so it must carry no
// view data — only who the user is. Data comes from IndexedDB and the
// browser loaders.
import { expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  getAuthUser: async () => ({ id: "user-1", email: "a@b.c", name: "A" }),
}));
vi.mock("@/components/view-switch", () => ({ ViewSwitch: () => null }));

import AppPage from "./page";

it("renders ViewSwitch with the user's identity and no view data", async () => {
  const el = await AppPage();
  expect(el.props).toEqual({ userId: "user-1", userEmail: "a@b.c", userName: "A" });
});
