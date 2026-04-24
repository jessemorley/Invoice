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
