import type { InvoiceStatus } from "@/lib/types";

export const INVOICE_STATUS_COLOR: Record<string, string> = {
  draft: "#9ca3af",
  issued: "#f97316",
  paid: "#22c55e",
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
  const dotColor = INVOICE_STATUS_COLOR[status] ?? NEUTRAL;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium shrink-0${className ? ` ${className}` : ""}`}
      style={{ color: NEUTRAL, backgroundColor: `${NEUTRAL}15`, borderColor: `${NEUTRAL}30` }}
    >
      <span className="size-1.5 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
      {number}
    </span>
  );
}
