import type { InvoiceStatus } from "@/lib/types";

export const INVOICE_STATUS_COLOR: Record<string, string> = {
  draft: "#94a3b8",
  issued: "#f97316",
  paid: "#10b981",
};

export function InvoiceStatusBadge({
  number,
  status,
  className,
}: {
  number: string;
  status: InvoiceStatus | "draft";
  className?: string;
}) {
  const color = INVOICE_STATUS_COLOR[status] ?? INVOICE_STATUS_COLOR.draft;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium shrink-0${className ? ` ${className}` : ""}`}
      style={{ color, backgroundColor: `${color}15`, borderColor: `${color}55` }}
    >
      {number}
    </span>
  );
}
