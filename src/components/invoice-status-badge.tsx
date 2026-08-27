import type { InvoiceStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export const INVOICE_STATUS_COLOR: Record<string, string> = {
  uninvoiced: "#9aa3b2",
  draft: "#5aa2e0",
  issued: "#f08c33",
  paid: "#1ab98a",
};

const NEUTRAL = "#9ca3af";

export function InvoiceStatusBadge({
  number,
  status,
  className,
}: {
  number: string;
  status: InvoiceStatus | "draft";
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
