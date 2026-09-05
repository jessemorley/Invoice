import { describe, expect, it } from "vitest";
import { displayStatus } from "./invoice-status-badge";

const TODAY = "2026-08-31";

describe("displayStatus", () => {
  it("derives overdue only once an issued invoice's due date has passed", () => {
    expect(displayStatus("issued", "2026-08-30", TODAY)).toBe("overdue");
    // Due today is not yet overdue — the client has until end of day.
    expect(displayStatus("issued", TODAY, TODAY)).toBe("issued");
    expect(displayStatus("issued", "2026-09-01", TODAY)).toBe("issued");
  });

  it("leaves every other status alone, however far past the due date", () => {
    expect(displayStatus("paid", "2026-01-01", TODAY)).toBe("paid");
    expect(displayStatus("draft", "2026-01-01", TODAY)).toBe("draft");
  });

  it("stays issued when there is no due date", () => {
    expect(displayStatus("issued", null, TODAY)).toBe("issued");
  });
});
