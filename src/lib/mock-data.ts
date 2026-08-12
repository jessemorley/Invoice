import type { ExpenseCategory } from "./types";

export type { ExpenseCategory };

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  gear:            "Gear",
  gear_consumable: "Gear Consumables",
  gear_hire:       "Gear Hire",
  lab:             "Lab",
  education:       "Education",
  software:        "Software",
  travel:          "Travel",
  other:           "Other",
  office:          "Office",
};

// Tax pools. Reporting split only — the tax estimate still deducts everything in full.
export const EXPENSE_POOL_LABELS = {
  depreciation: "Depreciation and capital expenses",
  other: "All other expenses",
} as const;

export type ExpensePool = keyof typeof EXPENSE_POOL_LABELS;

// Gear over $300 is a capital purchase; $300 and under is an immediate deduction.
// ponytail: tests the row amount as entered, so one row covering several sub-$300
// items reads as a single asset. Split the row, or test per unit if that bites.
export const DEPRECIATION_THRESHOLD = 300;

export function expensePool(category: ExpenseCategory, amount: number): ExpensePool {
  return category === "gear" && amount > DEPRECIATION_THRESHOLD ? "depreciation" : "other";
}

export const EXPENSE_CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  gear:            "#6366f1",
  gear_consumable: "#818cf8",
  gear_hire:       "#f97316",
  lab:             "#06b6d4",
  education:       "#8b5cf6",
  software:        "#10b981",
  travel:          "#f59e0b",
  other:           "#94a3b8",
  office:          "#64748b",
};
