"use client";

import { useTransition, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Client } from "@/lib/types";
import { formatAUD } from "@/lib/format";
import { updateClientColor, fetchClientInvoices, updateShowSuperOnInvoice, type RecentInvoice } from "@/app/(app)/clients/actions";
import { invalidate } from "@/lib/invalidate";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const CLIENT_COLOR_FALLBACK = "#9ca3af";

const PALETTE = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#14b8a6", "#06b6d4", "#3b82f6", "#6366f1",
  "#8b5cf6", "#ec4899", "#10b981", "#64748b",
];

const BILLING_LABEL: Record<string, string> = {
  day_rate: "Day rate",
  hourly: "Hourly",
  manual: "Manual",
};

function ColorDot({ clientId, current }: { clientId: string; current: string | null }) {
  const [isPending, startTransition] = useTransition();
  const active = current ?? CLIENT_COLOR_FALLBACK;

  function pick(color: string) {
    startTransition(async () => { await updateClientColor(clientId, color); invalidate("clients", "entries"); });
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="size-3 rounded-full shrink-0 ring-offset-background transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          style={{ backgroundColor: active }}
          aria-label="Change client colour"
        />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2.5" align="start">
        <div className={`flex gap-1.5 flex-wrap w-40${isPending ? " opacity-60 pointer-events-none" : ""}`}>
          {PALETTE.map((color) => (
            <button
              key={color}
              onClick={() => pick(color)}
              className="size-6 rounded-full border-2 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{
                backgroundColor: color,
                borderColor: active === color ? "white" : "transparent",
                boxShadow: active === color ? `0 0 0 2px ${color}` : undefined,
              }}
              aria-label={color}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  issued: "Issued",
  paid: "Paid",
};

const STATUS_VARIANT: Record<string, "secondary" | "outline" | "default"> = {
  draft: "secondary",
  issued: "outline",
  paid: "default",
};

function RecentInvoiceRow({ invoice }: { invoice: RecentInvoice }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="flex-1 min-w-0">
        <p className="font-medium">{invoice.number}</p>
        <p className="text-xs text-muted-foreground">
          {invoice.issued_date ? new Date(invoice.issued_date).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "—"}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <Badge variant={STATUS_VARIANT[invoice.status] ?? "secondary"} className="text-xs font-normal">
          {STATUS_LABEL[invoice.status] ?? invoice.status}
        </Badge>
        <span className="text-xs tabular-nums text-muted-foreground">{formatAUD(invoice.total)}</span>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

function SuperOnInvoiceToggle({ clientId, value }: { clientId: string; value: boolean }) {
  const [isPending, startTransition] = useTransition();
  return (
    <div className="flex justify-between items-center gap-4 text-sm">
      <span className="text-muted-foreground shrink-0">Show super on invoice</span>
      <Switch
        checked={value}
        disabled={isPending}
        onCheckedChange={(checked) => {
          startTransition(async () => { await updateShowSuperOnInvoice(clientId, checked); invalidate("clients"); });
        }}
      />
    </div>
  );
}

export function ClientSheet({
  open,
  onOpenChange,
  client,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
}) {
  const [recentInvoices, setRecentInvoices] = useState<RecentInvoice[] | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open || !client) return;
    setRecentInvoices(null);
    fetchClientInvoices(client.id).then(setRecentInvoices).catch(() => setRecentInvoices([]));
  }, [open, client]);

  if (!client) return null;

  const primaryRate = (() => {
    if (client.billing_type === "day_rate") {
      const parts = [];
      if (client.rate_full_day) parts.push(`${formatAUD(client.rate_full_day)} full`);
      if (client.rate_half_day) parts.push(`${formatAUD(client.rate_half_day)} half`);
      return parts.join(" / ") || "—";
    }
    if (client.billing_type === "hourly") {
      const rates = [
        client.rate_hourly && `${formatAUD(client.rate_hourly)}/hr`,
        client.rate_hourly_photographer && `${formatAUD(client.rate_hourly_photographer)}/hr photo`,
        client.rate_hourly_operator && `${formatAUD(client.rate_hourly_operator)}/hr op`,
      ].filter(Boolean);
      return rates.join(", ") || "—";
    }
    return "Manual";
  })();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col gap-0 p-0">
        <SheetHeader className="px-6 py-5 border-b">
          <div className="flex items-center gap-3">
            <ColorDot clientId={client.id} current={client.color} />
            <SheetTitle>{client.name}</SheetTitle>
            {!client.is_active && (
              <span className="ml-auto text-xs text-muted-foreground border rounded-full px-2 py-0.5">Inactive</span>
            )}
          </div>
          <SheetDescription>{BILLING_LABEL[client.billing_type]}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-6">
          {/* Contact */}
          <Section title="Contact">
            {client.contact_name && <Row label="Contact" value={client.contact_name} />}
            {client.email && <Row label="Email" value={<a href={`mailto:${client.email}`} className="underline underline-offset-2">{client.email}</a>} />}
            {(client.address || client.suburb) && (
              <Row label="Address" value={[client.address, client.suburb].filter(Boolean).join(", ")} />
            )}
            {client.abn && <Row label="ABN" value={client.abn} />}
          </Section>

          <Separator />

          {/* Billing rates */}
          <Section title="Billing Rates">
            <Row label="Type" value={BILLING_LABEL[client.billing_type]} />
            <Row label="Rate" value={primaryRate} />
            <Row label="Invoice frequency" value={client.invoice_frequency === "weekly" ? "Weekly" : "Per job"} />
            {client.pays_super && (
              <Row label="Super" value={`${(client.super_rate * 100).toFixed(1)}%`} />
            )}
            {client.pays_super && (
              <SuperOnInvoiceToggle clientId={client.id} value={client.show_super_on_invoice} />
            )}
          </Section>

          <Separator />

          {/* Settings */}
          <Section title="Settings">
            {client.entry_label && <Row label="Entry label" value={client.entry_label} />}
            <Row label="Show role" value={client.show_role ? "Yes" : "No"} />
          </Section>

          {client.notes && (
            <>
              <Separator />
              <Section title="Notes">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{client.notes}</p>
              </Section>
            </>
          )}

          <Separator />

          <Section title="Recent Invoices">
            {recentInvoices === null ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="flex-1 flex flex-col gap-1.5">
                      <Skeleton className="h-3.5 w-20" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <Skeleton className="h-5 w-12 rounded-full" />
                      <Skeleton className="h-3 w-14" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentInvoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No invoices yet.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {recentInvoices.map((inv) => (
                  <RecentInvoiceRow key={inv.id} invoice={inv} />
                ))}
                {client.invoice_count > 5 && (
                  <button
                    onClick={() => {
                      onOpenChange(false);
                      router.push(`/invoices?client=${client.id}`);
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors mt-1 text-left"
                  >
                    View all {client.invoice_count} invoices →
                  </button>
                )}
              </div>
            )}
          </Section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
