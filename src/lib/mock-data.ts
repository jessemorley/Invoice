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
