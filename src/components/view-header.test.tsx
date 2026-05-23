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

  it("tapping search icon replaces title with input", async () => {
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

  it("renders no filter button when children are absent", () => {
    renderHeader();
    expect(screen.queryByRole("button", { name: /filter/i })).not.toBeInTheDocument();
  });

  it("renders a filter button when children are provided", () => {
    renderHeader({ children: <div>a filter</div> });
    expect(screen.getByRole("button", { name: /filter/i })).toBeInTheDocument();
  });

  it("filter button tap shows children in filter bar", async () => {
    const user = userEvent.setup();
    renderHeader({ children: <div>a filter</div> });
    expect(screen.getByTestId("mobile-filter-bar")).not.toBeVisible();
    await user.click(screen.getByRole("button", { name: /filter/i }));
    expect(screen.getByTestId("mobile-filter-bar")).toBeVisible();
  });

  it("second filter button tap hides filter bar", async () => {
    const user = userEvent.setup();
    renderHeader({ children: <div>a filter</div> });
    await user.click(screen.getByRole("button", { name: /filter/i }));
    await user.click(screen.getByRole("button", { name: /filter/i }));
    expect(screen.getByTestId("mobile-filter-bar")).not.toBeVisible();
  });

  it("opening search hides the filter button", async () => {
    const user = userEvent.setup();
    renderHeader({ children: <div>a filter</div> });
    await user.click(screen.getByRole("button", { name: /search/i }));
    expect(screen.queryByRole("button", { name: /filter/i })).not.toBeInTheDocument();
  });

  it("loading prop disables search and filter buttons", () => {
    renderHeader({ children: <div>a filter</div>, loading: true });
    expect(screen.getByRole("button", { name: /search/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /filter/i })).toBeDisabled();
  });
});
