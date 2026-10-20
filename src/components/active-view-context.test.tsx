// Tab switches must not fetch the route from the server: offline that fetch
// fails and Next falls back to a full reload (found in the offline spike).
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { router, params } = vi.hoisted(() => ({
  router: { replace: vi.fn(), push: vi.fn(), refresh: vi.fn() },
  params: { value: new URLSearchParams() },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => params.value,
}));

import { ActiveViewProvider, useActiveView } from "./active-view-context";

function Probe() {
  const { view, settingsTab, setView } = useActiveView();
  return (
    <>
      <span data-testid="view">{view}:{settingsTab ?? ""}</span>
      <button onClick={() => setView("invoices")}>invoices</button>
      <button onClick={() => setView("settings", { settingsTab: "account" })}>settings</button>
    </>
  );
}

beforeEach(() => {
  params.value = new URLSearchParams();
  Object.values(router).forEach((f) => f.mockClear());
});

describe("ActiveViewProvider", () => {
  it("starts on the view in the URL, defaulting to entries", () => {
    params.value = new URLSearchParams("view=tax");
    render(<ActiveViewProvider><Probe /></ActiveViewProvider>);
    expect(screen.getByTestId("view").textContent).toBe("tax:");
  });

  it("defaults to entries", () => {
    render(<ActiveViewProvider><Probe /></ActiveViewProvider>);
    expect(screen.getByTestId("view").textContent).toBe("entries:");
  });

  it("switches views with history.replaceState and never the Next router", () => {
    const replaceState = vi.spyOn(window.history, "replaceState");
    render(<ActiveViewProvider><Probe /></ActiveViewProvider>);
    fireEvent.click(screen.getByText("invoices"));
    expect(screen.getByTestId("view").textContent).toBe("invoices:");
    expect(replaceState).toHaveBeenLastCalledWith(null, "", "/?view=invoices");
    fireEvent.click(screen.getByText("settings"));
    expect(replaceState).toHaveBeenLastCalledWith(null, "", "/?view=settings&tab=account");
    expect(router.replace).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
    expect(router.refresh).not.toHaveBeenCalled();
    replaceState.mockRestore();
  });
});
