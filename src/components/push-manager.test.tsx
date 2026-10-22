// Phase 3 changed only how the worker is registered (/sw.js?build=<id>, so
// each deploy installs a new worker). Push re-assertion and the app-icon badge
// must behave as before.
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { save } = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock("@/app/(app)/settings/actions", () => ({ savePushSubscription: save }));

import { PushManager } from "./push-manager";

const register = vi.fn();
const setAppBadge = vi.fn();
const clearAppBadge = vi.fn();
const subscription = { endpoint: "https://push.example/1", toJSON: () => ({ keys: { p256dh: "p", auth: "a" } }) };

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_BUILD_ID", "abc123");
  register.mockReset().mockResolvedValue({});
  setAppBadge.mockReset().mockResolvedValue(undefined);
  clearAppBadge.mockReset().mockResolvedValue(undefined);
  save.mockReset().mockResolvedValue(undefined);
  Object.assign(navigator, {
    serviceWorker: { register, ready: Promise.resolve({ pushManager: { getSubscription: async () => subscription } }) },
    setAppBadge,
    clearAppBadge,
  });
  vi.stubGlobal("PushManager", function PushManager() {});
  vi.stubGlobal("Notification", { permission: "granted" });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

describe("PushManager", () => {
  it("registers the worker under the build ID", () => {
    render(<PushManager />);
    expect(register).toHaveBeenCalledWith("/sw.js?build=abc123");
  });

  it("re-asserts an existing push subscription when permission is granted", async () => {
    render(<PushManager />);
    await flush();
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ endpoint: subscription.endpoint, p256dh: "p", auth: "a" }));
  });

  it("never prompts or re-asserts without permission", async () => {
    vi.stubGlobal("Notification", { permission: "default" });
    render(<PushManager />);
    await flush();
    expect(save).not.toHaveBeenCalled();
  });

  it("mirrors the uninvoiced count onto the app-icon badge", () => {
    render(<PushManager />);
    act(() => { window.dispatchEvent(new CustomEvent("dock:uninvoiced-count", { detail: 3 })); });
    expect(setAppBadge).toHaveBeenCalledWith(3);
    act(() => { window.dispatchEvent(new CustomEvent("dock:uninvoiced-count", { detail: 0 })); });
    expect(clearAppBadge).toHaveBeenCalledTimes(1);
  });
});
