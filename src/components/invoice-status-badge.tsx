import type { InvoiceStatus } from "@/lib/types";
import { toLocalDateStr } from "@/lib/format";
import { cn } from "@/lib/utils";

export const INVOICE_STATUS_COLOR: Record<string, string> = {
  uninvoiced: "#9aa3b2",
  draft: "#9aa3b2",
  issued: "#5aa2e0",
  overdue: "#e0674a",
  paid: "#1ab98a",
};

export const INVOICE_STATUS_LABEL: Record<DisplayStatus, string> = {
  draft: "Draft",
  issued: "Issued",
  overdue: "Overdue",
  paid: "Paid",
};

// "overdue" is derived at render time, never stored — an issued invoice becomes
// overdue the moment its due date passes, with no job to flip the row.
export type DisplayStatus = InvoiceStatus | "overdue";

export function displayStatus(
  status: InvoiceStatus,
  dueDate: string | null,
  today = toLocalDateStr(new Date()),
): DisplayStatus {
  return status === "issued" && dueDate && dueDate < today ? "overdue" : status;
}

const NEUTRAL = "#9ca3af";

export function InvoiceStatusBadge({
  number,
  status,
  className,
}: {
  number: string;
  status: DisplayStatus;
  className?: string;
}) {
  const statusColor = INVOICE_STATUS_COLOR[status] ?? NEUTRAL;

  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-medium shrink-0", className)}
      style={{ color: NEUTRAL, backgroundColor: "#000000", borderColor: `${NEUTRAL}30` }}
    >
      <span className="size-1.5 rounded-full shrink-0" style={{ backgroundColor: statusColor }} />
      {number}
    </span>
  );
}
