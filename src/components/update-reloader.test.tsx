// Offline-first launch, phase 4: after a deploy, a cached old build calls
// server actions the server no longer knows. The app must notice the new
// build and reload into it at a safe moment — never while a form is open.
// Written ahead of the implementation as its acceptance spec.
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UpdateReloader } from "./update-reloader";

let deployed: string | Error = "abc";
const replace = vi.fn();

beforeEach(() => {
  deployed = "abc";
  replace.mockReset();
  vi.stubEnv("NEXT_PUBLIC_BUILD_ID", "abc");
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    expect(url).toBe("/api/version");
    if (deployed instanceof Error) throw deployed;
    return new Response(JSON.stringify({ build: deployed }));
  }));
  setUrl("/?view=tax");
});

function setUrl(path: string) {
  const url = new URL(path, "https://app.test");
  vi.stubGlobal("location", { href: url.href, pathname: url.pathname, search: url.search, hash: "", origin: url.origin, replace });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
}

function openSheet(role = "dialog") {
  const el = document.createElement("div");
  el.setAttribute("role", role);
  document.body.appendChild(el);
  return el;
}

describe("UpdateReloader", () => {
  it("does nothing while the deployed build matches", async () => {
    render(<UpdateReloader />);
    await flush();
    expect(replace).not.toHaveBeenCalled();
  });

  it("reloads into a new build, bypassing the cached page", async () => {
    deployed = "def";
    render(<UpdateReloader />);
    await flush();
    expect(replace).toHaveBeenCalledTimes(1);
    const url = new URL(replace.mock.calls[0][0], "https://app.test");
    expect(url.pathname).toBe("/");
    expect(url.searchParams.get("view")).toBe("tax"); // stays on the same tab
    expect(url.searchParams.get("fresh")).toBe("1");
  });

  it("never reloads while a sheet or dialog is open", async () => {
    deployed = "def";
    openSheet("dialog");
    openSheet("alertdialog");
    render(<UpdateReloader />);
    await flush();
    expect(replace).not.toHaveBeenCalled();
  });

  it("reloads at the next safe moment: when the app goes to the background with nothing open", async () => {
    deployed = "def";
    const sheet = openSheet();
    render(<UpdateReloader />);
    await flush();
    act(() => setVisibility("hidden"));
    expect(replace).not.toHaveBeenCalled(); // sheet still open
    sheet.remove();
    act(() => setVisibility("hidden"));
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it("checks again when the app returns to the foreground", async () => {
    render(<UpdateReloader />);
    await flush();
    deployed = "def";
    act(() => setVisibility("visible"));
    await flush();
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it("checks again when the connection comes back", async () => {
    deployed = new TypeError("offline");
    render(<UpdateReloader />);
    await flush();
    expect(replace).not.toHaveBeenCalled();
    deployed = "def";
    act(() => { window.dispatchEvent(new Event("online")); });
    await flush();
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it("never reloads in development builds", async () => {
    vi.stubEnv("NEXT_PUBLIC_BUILD_ID", "dev");
    deployed = "def";
    render(<UpdateReloader />);
    await flush();
    expect(replace).not.toHaveBeenCalled();
  });

  it("strips the fresh flag from the address after the reload", async () => {
    setUrl("/?view=tax&fresh=1");
    const replaceState = vi.spyOn(window.history, "replaceState").mockImplementation(() => {});
    render(<UpdateReloader />);
    await flush();
    expect(replaceState).toHaveBeenCalledWith(null, "", "/?view=tax");
    expect(replace).not.toHaveBeenCalled(); // same build: no reload loop
    replaceState.mockRestore();
  });
});
