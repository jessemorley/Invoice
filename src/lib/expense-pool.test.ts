import { describe, expect, it } from "vitest";
import { EXPENSE_CATEGORY_LABELS, expensePool } from "./mock-data";
import type { ExpenseCategory } from "./types";

describe("expensePool", () => {
  it("puts gear over $300 in the depreciation pool", () => {
    expect(expensePool("gear", 2000)).toBe("depreciation");
    expect(expensePool("gear", 300.01)).toBe("depreciation");
  });

  it("treats $300 exactly as an immediate deduction", () => {
    expect(expensePool("gear", 300)).toBe("other");
    expect(expensePool("gear", 299.99)).toBe("other");
  });

  it("never depreciates a non-gear category, however large", () => {
    const others = (Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[]).filter((c) => c !== "gear");
    for (const category of others) {
      expect(expensePool(category, 10_000)).toBe("other");
    }
  });
});
