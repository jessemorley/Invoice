import type { InvoiceStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export const INVOICE_STATUS_COLOR: Record<string, string> = {
  draft: "#9ca3af",
  issued: "#eab308",
  paid: "#22c55e",
};

const NEUTRAL = "#9ca3af";

export function InvoiceStatusBadge({
  number,
  status,
  tinted = false,
  className,
}: {
  number: string;
  status: InvoiceStatus | "draft";
  /** Colour the whole chip by status instead of showing a neutral pill with a status dot. */
  tinted?: boolean;
  className?: string;
}) {
  const statusColor = INVOICE_STATUS_COLOR[status] ?? NEUTRAL;

  if (tinted) {
    // Matches the expense category tags: solid tint, no border.
    return (
      <span
        className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium shrink-0", className)}
        style={{ color: statusColor, backgroundColor: `${statusColor}22` }}
      >
        {number}
      </span>
    );
  }

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
