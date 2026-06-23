import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Line item `amount` is the unit price; `quantity` (when set) multiplies it.
export function lineItemTotal(item: { quantity: number | null; amount: number }): number {
  return item.quantity != null ? item.quantity * item.amount : item.amount;
}

export function computeDueDate(issuedDate: string, offset: number): string {
  const d = new Date(issuedDate + "T00:00:00");
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}
