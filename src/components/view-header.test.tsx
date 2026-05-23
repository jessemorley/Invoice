import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ViewHeader } from "./view-header";

vi.mock("@/components/ui/sidebar", () => ({
  SidebarTrigger: () => null,
}));

function renderHeader(props: Partial<Parameters<typeof ViewHeader>[0]> = {}) {
  return render(
    <ViewHeader
      title="Entries"
      searchValue=""
      onSearchChange={vi.fn()}
      {...props}
    />
  );
}

describe("ViewHeader", () => {
  it("renders the title", () => {
    renderHeader();
    expect(screen.getByText("Entries")).toBeInTheDocument();
  });

  it("tapping search icon hides title and shows close button", async () => {
    const user = userEvent.setup();
    renderHeader();
    await user.click(screen.getByRole("button", { name: /search/i }));
    expect(screen.queryByRole("heading", { name: "Entries" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /close search/i })).toBeInTheDocument();
  });

  it("tapping X closes search, restores title, and clears value", async () => {
    const user = userEvent.setup();
    const onSearchChange = vi.fn();
    renderHeader({ searchValue: "foo", onSearchChange });
    await user.click(screen.getByRole("button", { name: /search/i }));
    await user.click(screen.getByRole("button", { name: /close search/i }));
    expect(screen.getByRole("heading", { name: "Entries" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /close search/i })).not.toBeInTheDocument();
    expect(onSearchChange).toHaveBeenCalledWith("");
  });

  it("Escape key closes search and clears value", async () => {
    const user = userEvent.setup();
    const onSearchChange = vi.fn();
    renderHeader({ onSearchChange });
    await user.click(screen.getByRole("button", { name: /search/i }));
    await user.keyboard("{Escape}");
    expect(screen.getByText("Entries")).toBeInTheDocument();
    expect(onSearchChange).toHaveBeenCalledWith("");
  });

  it("renders no filter button when onFilterToggle is absent", () => {
    renderHeader();
    expect(screen.queryByRole("button", { name: /filter/i })).not.toBeInTheDocument();
  });

  it("renders a filter button when onFilterToggle is provided", () => {
    renderHeader({ onFilterToggle: vi.fn() });
    expect(screen.getByRole("button", { name: /filter/i })).toBeInTheDocument();
  });

  it("tapping filter button calls onFilterToggle", async () => {
    const user = userEvent.setup();
    const onFilterToggle = vi.fn();
    renderHeader({ onFilterToggle });
    await user.click(screen.getByRole("button", { name: /filter/i }));
    expect(onFilterToggle).toHaveBeenCalledOnce();
  });

  it("filter button stays visible when search is open", async () => {
    const user = userEvent.setup();
    renderHeader({ onFilterToggle: vi.fn() });
    await user.click(screen.getByRole("button", { name: /search/i }));
    expect(screen.getByRole("button", { name: /filter/i })).toBeInTheDocument();
  });

  it("loading prop disables search and filter buttons", () => {
    renderHeader({ onFilterToggle: vi.fn(), loading: true });
    expect(screen.getByRole("button", { name: /search/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /filter/i })).toBeDisabled();
  });

  it("renders a filter button when filterPopover is provided", () => {
    renderHeader({ filterPopover: <div>options</div> });
    expect(screen.getByRole("button", { name: /filter/i })).toBeInTheDocument();
  });

  it("filterActive dot shows on popover filter button", () => {
    const { container } = renderHeader({ filterPopover: <div>options</div>, filterActive: true });
    expect(container.querySelector(".bg-primary")).toBeInTheDocument();
  });

  it("clicking popover option closes the popover", async () => {
    const user = userEvent.setup();
    renderHeader({
      filterPopover: <button>Option A</button>,
    });
    await user.click(screen.getByRole("button", { name: /filter/i }));
    expect(screen.getByText("Option A")).toBeInTheDocument();
    await user.click(screen.getByText("Option A"));
    expect(screen.queryByText("Option A")).not.toBeInTheDocument();
  });
});
