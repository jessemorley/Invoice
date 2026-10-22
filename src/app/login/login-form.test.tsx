// Reaching /login means there is no valid session (logout, expiry, proxy
// redirect): the previous user's saved data and cached pages must go.
import { render } from "@testing-library/react";
import { expect, it, vi } from "vitest";

const { cache } = vi.hoisted(() => ({ cache: { clearCache: vi.fn(), clearCachedPages: vi.fn() } }));
vi.mock("@/lib/view-cache", () => cache);
vi.mock("./actions", () => ({ signIn: vi.fn() }));

import { LoginForm } from "./login-form";

it("clears the saved view data and the cached pages when shown", () => {
  render(<LoginForm />);
  expect(cache.clearCache).toHaveBeenCalledTimes(1);
  expect(cache.clearCachedPages).toHaveBeenCalledTimes(1);
});
