import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FloatingDock } from "./floating-dock";

// Mock next/navigation (used inside useActiveView)
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => ({ get: () => null }),
}));

// Mock useActiveView so we can control the active view
const mockSetView = vi.fn();
let mockView = "entries";

vi.mock("@/components/active-view-context", () => ({
  useActiveView: () => ({ view: mockView, setView: mockSetView }),
}));

function renderDock(uninvoicedCount = 0) {
  const result = render(<FloatingDock />);
  if (uninvoicedCount > 0) {
    act(() => {
      window.dispatchEvent(new CustomEvent("dock:uninvoiced-count", { detail: uninvoicedCount }));
    });
  }
  return result;
}

function listenForEvent(eventName: string): Promise<Event> {
  return new Promise((resolve) => {
    window.addEventListener(eventName, resolve, { once: true });
  });
}

beforeEach(() => {
  mockView = "entries";
  mockSetView.mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("Plus button", () => {
  it("dispatches dock:new with entries detail when tapped on entries view", async () => {
    mockView = "entries";
    renderDock();
    const eventPromise = listenForEvent("dock:new") as Promise<CustomEvent<string>>;
    fireEvent.click(screen.getByRole("button", { name: /new/i }));
    const e = await eventPromise;
    expect(e.detail).toBe("entries");
  });

  it("dispatches dock:new with invoices detail when tapped on invoices view", async () => {
    mockView = "invoices";
    renderDock();
    const eventPromise = listenForEvent("dock:new") as Promise<CustomEvent<string>>;
    fireEvent.click(screen.getByRole("button", { name: /new/i }));
    const e = await eventPromise;
    expect(e.detail).toBe("invoices");
  });

  it("dispatches dock:new with expenses detail when tapped on expenses view", async () => {
    mockView = "expenses";
    renderDock();
    const eventPromise = listenForEvent("dock:new") as Promise<CustomEvent<string>>;
    fireEvent.click(screen.getByRole("button", { name: /new/i }));
    const e = await eventPromise;
    expect(e.detail).toBe("expenses");
  });

  it("is enabled on expenses view", () => {
    mockView = "expenses";
    renderDock();
    expect(screen.getByRole("button", { name: /new/i })).not.toBeDisabled();
  });

  it("is present but disabled when active view is dashboard", () => {
    mockView = "dashboard";
    renderDock();
    expect(screen.getByRole("button", { name: /new/i })).toBeDisabled();
  });

  it("is present but disabled when active view is clients", () => {
    mockView = "clients";
    renderDock();
    expect(screen.getByRole("button", { name: /new/i })).toBeDisabled();
  });

  it("is present but disabled when active view is settings", () => {
    mockView = "settings";
    renderDock();
    expect(screen.getByRole("button", { name: /new/i })).toBeDisabled();
  });

  it("does not dispatch dock:new when disabled (settings view)", async () => {
    mockView = "settings";
    renderDock();
    let fired = false;
    window.addEventListener("dock:new", () => { fired = true; }, { once: true });
    fireEvent.click(screen.getByRole("button", { name: /new/i }));
    await new Promise((r) => setTimeout(r, 0));
    expect(fired).toBe(false);
  });
});

describe("Tab buttons", () => {
  it("calls setView when an inactive tab is tapped", () => {
    mockView = "entries";
    renderDock();
    fireEvent.click(screen.getByRole("button", { name: /invoices/i }));
    expect(mockSetView).toHaveBeenCalledWith("invoices");
  });
});

describe("uninvoicedCount badge", () => {
  it("shows badge when uninvoicedCount > 0", () => {
    mockView = "invoices";
    renderDock(3);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("does not show badge when uninvoicedCount is 0", () => {
    mockView = "invoices";
    renderDock(0);
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
});

describe("overflow menu", () => {
  it("is hidden on mount", () => {
    renderDock();
    expect(screen.queryByRole("button", { name: /dashboard/i })).not.toBeInTheDocument();
  });

  it("shows secondary nav items after menu button tap", async () => {
    const user = userEvent.setup();
    renderDock();
    await user.click(screen.getByRole("button", { name: /menu/i }));
    expect(screen.getByRole("button", { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /clients/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /expenses/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /settings/i })).toBeInTheDocument();
  });

  it("closes when overlay is clicked", async () => {
    const user = userEvent.setup();
    renderDock();
    await user.click(screen.getByRole("button", { name: /menu/i }));
    expect(screen.getByRole("button", { name: /dashboard/i })).toBeInTheDocument();
    // Click the overlay (the fixed inset-0 div behind the menu)
    const overlay = document.querySelector("[data-testid='menu-overlay']") as HTMLElement;
    await user.click(overlay);
    expect(screen.queryByRole("button", { name: /dashboard/i })).not.toBeInTheDocument();
  });

  it("calls setView and closes menu when a secondary item is tapped", async () => {
    const user = userEvent.setup();
    renderDock();
    await user.click(screen.getByRole("button", { name: /menu/i }));
    await user.click(screen.getByRole("button", { name: /dashboard/i }));
    expect(mockSetView).toHaveBeenCalledWith("dashboard");
    expect(screen.queryByRole("button", { name: /dashboard/i })).not.toBeInTheDocument();
  });
});
