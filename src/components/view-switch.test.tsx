// Offline-first launch, phases 1–3: ViewSwitch loads views in the browser,
// shows last-seen data from the device cache at once, never lets an older
// saved copy beat fresher data, saves what it fetches, refreshes on
// invalidate / resume / reconnect, and sends a signed-out user to /login.
import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ViewId } from "@/components/active-view-context";

// --- stubs -----------------------------------------------------------------

let mockView: ViewId = "entries";
vi.mock("@/components/active-view-context", () => ({
  useActiveView: () => ({ view: mockView, settingsTab: undefined, setView: vi.fn() }),
}));

// Lazy views, in ViewSwitch's dynamic() call order. Each stub renders its props.
vi.mock("next/dynamic", () => {
  const names = ["dashboard", "invoices", "clients", "expenses", "settings", "tax", "emails"];
  let i = 0;
  return {
    default: () => {
      const name = names[i++ % names.length];
      return (props: Record<string, unknown>) => <pre data-testid={name}>{JSON.stringify(props)}</pre>;
    },
  };
});
vi.mock("@/components/entries-view", () => ({
  EntriesView: (props: Record<string, unknown>) => <pre data-testid="entries">{JSON.stringify(props)}</pre>,
}));

const { loaders, cache, SignedOutError } = vi.hoisted(() => {
  const fn = () => vi.fn();
  return {
    SignedOutError: class SignedOutError extends Error {},
    loaders: {
      loadDashboardViewData: fn(),
      loadEntriesViewData: fn(),
      loadInvoicesViewData: fn(),
      loadClientsViewData: fn(),
      loadExpensesViewData: fn(),
      loadSettingsViewData: fn(),
      loadTaxViewData: fn(),
      loadEmailsViewData: fn(),
    },
    cache: { readCache: fn(), writeCache: fn() },
  };
});
vi.mock("@/lib/view-loaders", () => ({ ...loaders, SignedOutError }));
vi.mock("@/lib/view-cache", () => cache);

import { ViewSwitch } from "./view-switch";

// --- helpers ---------------------------------------------------------------

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => ((resolve = res), (reject = rej)));
  return { promise, resolve, reject };
}

const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

function propsOf(testId: string) {
  return JSON.parse(screen.getByTestId(testId).textContent!);
}

const entriesData = (label: string) => ({ entries: [{ id: label }], clients: [], workflowRates: [] });

function renderSwitch(userId = "user-1") {
  return render(<ViewSwitch userId={userId} userEmail="a@b.c" userName="A" />);
}

beforeEach(() => {
  mockView = "entries";
  Object.values(loaders).forEach((l) => l.mockReset().mockReturnValue(new Promise(() => {})));
  cache.readCache.mockReset().mockResolvedValue({});
  cache.writeCache.mockReset().mockResolvedValue(undefined);
});

// --- phase 1: browser loaders ----------------------------------------------

describe("loading views", () => {
  it("loads the active view through the browser loader on first reveal", async () => {
    renderSwitch();
    await flush();
    expect(loaders.loadEntriesViewData).toHaveBeenCalledTimes(1);
    expect(loaders.loadDashboardViewData).not.toHaveBeenCalled();
  });

  it("shows the loader's data", async () => {
    loaders.loadEntriesViewData.mockResolvedValue(entriesData("fresh"));
    renderSwitch();
    await flush();
    expect(propsOf("entries")).toMatchObject({ entries: [{ id: "fresh" }], loading: false });
  });

  it("starts loading with no data in the page (nothing embedded in the HTML)", () => {
    renderSwitch();
    expect(propsOf("entries")).toMatchObject({ loading: true });
  });
});

// --- phase 2: device cache ---------------------------------------------------

describe("last-seen data on the device", () => {
  it("reads the cache for the signed-in user", async () => {
    renderSwitch("user-42");
    await flush();
    expect(cache.readCache).toHaveBeenCalledWith("user-42", expect.arrayContaining(["entries", "dashboard", "invoices", "tax"]));
  });

  it("shows saved data immediately, before the network answers", async () => {
    cache.readCache.mockResolvedValue({ entries: entriesData("saved") });
    renderSwitch();
    await flush();
    expect(propsOf("entries")).toMatchObject({ entries: [{ id: "saved" }], loading: false });
  });

  it("fills views that haven't been opened yet, so every tab is instant", async () => {
    cache.readCache.mockResolvedValue({ tax: [{ startYear: 2026 }] });
    renderSwitch();
    await flush();
    expect(propsOf("tax")).toEqual({ fyTotals: [{ startYear: 2026 }] });
  });

  it("replaces saved data with fresh data when it arrives", async () => {
    const fetch = deferred<ReturnType<typeof entriesData>>();
    loaders.loadEntriesViewData.mockReturnValue(fetch.promise);
    cache.readCache.mockResolvedValue({ entries: entriesData("saved") });
    renderSwitch();
    await flush();
    await act(async () => fetch.resolve(entriesData("fresh")));
    expect(propsOf("entries").entries).toEqual([{ id: "fresh" }]);
  });

  it("never lets an older saved copy overwrite data already fetched", async () => {
    const read = deferred<Record<string, unknown>>();
    cache.readCache.mockReturnValue(read.promise);
    loaders.loadEntriesViewData.mockResolvedValue(entriesData("fresh"));
    renderSwitch();
    await flush();
    await act(async () => read.resolve({ entries: entriesData("saved") }));
    expect(propsOf("entries").entries).toEqual([{ id: "fresh" }]);
  });

  it("saves each fetched view, after the cache has been checked for this user", async () => {
    const read = deferred<Record<string, unknown>>();
    cache.readCache.mockReturnValue(read.promise);
    loaders.loadEntriesViewData.mockResolvedValue(entriesData("fresh"));
    renderSwitch();
    await flush();
    expect(cache.writeCache).not.toHaveBeenCalled(); // a wipe of another user's data could still be pending
    await act(async () => read.resolve({}));
    await flush();
    expect(cache.writeCache).toHaveBeenCalledWith("entries", entriesData("fresh"));
  });

  it("updates the dock badge only from fresh invoices data, never from the cache", async () => {
    mockView = "invoices";
    const counts: number[] = [];
    const onCount = (e: Event) => counts.push((e as CustomEvent<number>).detail);
    window.addEventListener("dock:uninvoiced-count", onCount);
    const fetch = deferred<object>();
    loaders.loadInvoicesViewData.mockReturnValue(fetch.promise);
    cache.readCache.mockResolvedValue({ invoices: { invoices: [], uninvoicedCount: 9, hasUninvoiced: true, clients: [], suggested: [] } });
    renderSwitch();
    await flush();
    expect(counts).toEqual([]);
    await act(async () => fetch.resolve({ invoices: [], uninvoicedCount: 2, hasUninvoiced: true, clients: [], suggested: [] }));
    expect(counts).toEqual([2]);
    window.removeEventListener("dock:uninvoiced-count", onCount);
  });
});

// --- refresh triggers ------------------------------------------------------

describe("refreshing", () => {
  it("re-fetches loaded views affected by invalidate(), and only those", async () => {
    renderSwitch();
    await flush();
    loaders.loadEntriesViewData.mockClear();
    act(() => { window.dispatchEvent(new CustomEvent("data:invalidate", { detail: "entries" })); });
    expect(loaders.loadEntriesViewData).toHaveBeenCalledTimes(1);
    // dashboard/invoices are affected by "entries" but were never opened
    expect(loaders.loadDashboardViewData).not.toHaveBeenCalled();
    expect(loaders.loadInvoicesViewData).not.toHaveBeenCalled();
  });

  it("re-fetches the active view when the app comes back to the foreground", async () => {
    renderSwitch();
    await flush();
    loaders.loadEntriesViewData.mockClear();
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(loaders.loadEntriesViewData).toHaveBeenCalledTimes(1);
  });

  it("re-fetches the active view when the connection comes back", async () => {
    renderSwitch();
    await flush();
    loaders.loadEntriesViewData.mockClear();
    act(() => { window.dispatchEvent(new Event("online")); });
    expect(loaders.loadEntriesViewData).toHaveBeenCalledTimes(1);
  });
});

// --- phase 3: signed out under a cached page ---------------------------------

describe("signed out", () => {
  function stubLocation() {
    const replace = vi.fn();
    vi.stubGlobal("location", { ...window.location, replace });
    return replace;
  }

  it("goes to /login when a loader finds the session gone for good", async () => {
    const replace = stubLocation();
    loaders.loadEntriesViewData.mockRejectedValue(new SignedOutError());
    renderSwitch();
    await flush();
    expect(replace).toHaveBeenCalledWith("/login");
    vi.unstubAllGlobals();
  });

  it("stays put on other failures (e.g. offline), keeping the saved data", async () => {
    const replace = stubLocation();
    const onUnhandled = vi.fn();
    process.on("unhandledRejection", onUnhandled);
    cache.readCache.mockResolvedValue({ entries: entriesData("saved") });
    loaders.loadEntriesViewData.mockRejectedValue(new TypeError("Failed to fetch"));
    renderSwitch();
    await flush();
    expect(replace).not.toHaveBeenCalled();
    expect(propsOf("entries").entries).toEqual([{ id: "saved" }]);
    process.off("unhandledRejection", onUnhandled);
    vi.unstubAllGlobals();
  });
});
