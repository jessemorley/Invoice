"use client";

import { useState, useEffect, useTransition } from "react";
import type { Invoice, InvoiceStatus } from "@/lib/types";
import { formatAUD, formatDateShort } from "@/lib/format";
import { updateInvoice, deleteInvoice } from "@/app/(app)/invoices/actions";
import { invalidate } from "@/lib/invalidate";
import type { InvoiceFormData } from "@/app/(app)/invoices/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ScheduledEmail } from "@/lib/queries";
import { Download, Mail, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: "Draft",
  issued: "Issued",
  paid: "Paid",
};

const STATUS_VARIANT: Record<InvoiceStatus, "outline" | "secondary" | "default"> = {
  draft: "outline",
  issued: "secondary",
  paid: "default",
};

function defaultForm(invoice: Invoice): InvoiceFormData {
  const inv = invoice as Invoice & { due_date?: string | null; notes?: string | null };
  return {
    status: inv.status,
    issued_date: inv.issued_date ?? "",
    due_date: inv.due_date ?? "",
    notes: inv.notes ?? "",
  };
}

export function InvoiceSheet({
  open,
  onOpenChange,
  invoice,
  scheduledEmail,
  onSendClick,
  onCancelEmail,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice | null;
  scheduledEmail?: ScheduledEmail | null;
  onSendClick?: () => void;
  onCancelEmail?: (id: string) => void;
}) {
  const [form, setForm] = useState<InvoiceFormData | null>(
    invoice ? defaultForm(invoice) : null
  );
  const [isPending, startTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(invoice ? defaultForm(invoice) : null);
    setError(null);
  }, [invoice, open]);

  if (!invoice || !form) return null;

  function set<K extends keyof InvoiceFormData>(key: K, value: InvoiceFormData[K]) {
    setForm((prev) => prev ? { ...prev, [key]: value } : prev);
  }

  function handleDelete() {
    if (!invoice) return;
    startDeleteTransition(async () => {
      try {
        await deleteInvoice(invoice.id);
        invalidate("invoices", "entries");
        onOpenChange(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  function handleSubmit() {
    if (!invoice || !form) return;
    setError(null);
    startTransition(async () => {
      try {
        await updateInvoice(invoice.id, form);
        invalidate("invoices", "entries");
        onOpenChange(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col gap-0 p-0">
        <SheetHeader className="px-6 py-5 border-b">
          <div className="flex items-center gap-3">
            <div
              className="size-3 rounded-full shrink-0"
              style={{ backgroundColor: invoice.client.color }}
            />
            <SheetTitle>{invoice.number}</SheetTitle>
            <Badge variant={STATUS_VARIANT[form.status]} className="ml-auto">
              {STATUS_LABEL[form.status]}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{invoice.client.name}</p>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
          {/* Summary */}
          <div className="rounded-lg bg-muted/40 px-4 py-3 flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Issued</span>
              <span>{invoice.issued_date ? formatDateShort(invoice.issued_date) : "—"}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-medium">
              <span>Total</span>
              <span className="tabular-nums">{formatAUD(invoice.total)}</span>
            </div>
            {invoice.super_amount > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>incl. super</span>
                <span className="tabular-nums">{formatAUD(invoice.super_amount)}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild className="gap-1.5">
              <a href={`/api/invoices/${invoice.id}/pdf`} download>
                <Download className="size-3.5" />
                Download PDF
              </a>
            </Button>
            {!scheduledEmail || scheduledEmail.status === "cancelled" ? (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={onSendClick}>
                <Mail className="size-3.5" />
                Email
              </Button>
            ) : scheduledEmail.status === "pending" ? (
              <>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={onSendClick}>
                  <Mail className="size-3.5" />
                  Scheduled
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => onCancelEmail?.(scheduledEmail.id)}
                >
                  Cancel send
                </Button>
              </>
            ) : scheduledEmail.status === "sent" ? (
              <span className="text-sm text-muted-foreground self-center">
                Sent {scheduledEmail.sent_at ? formatDateShort(scheduledEmail.sent_at) : ""}
              </span>
            ) : scheduledEmail.status === "failed" ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-destructive border-destructive/40 hover:text-destructive"
                onClick={onSendClick}
              >
                <Mail className="size-3.5" />
                Failed — Retry
              </Button>
            ) : null}
          </div>

          {/* Status */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Status</label>
            <Select
              value={form.status}
              onValueChange={(v) => set("status", v as InvoiceStatus)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="issued">Issued</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Issued date */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Issued date</label>
            <Input
              type="date"
              value={form.issued_date}
              onChange={(e) => set("issued_date", e.target.value)}
            />
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Notes</label>
            <Textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Optional notes for this invoice…"
              rows={3}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <SheetFooter className="px-6 py-4 border-t flex-row gap-2">
          <Button
            variant="destructive"
            size="icon"
            className="shrink-0"
            onClick={handleDelete}
            disabled={isDeleting || isPending}
          >
            <Trash2 className="size-4" />
          </Button>
          <SheetClose asChild>
            <Button variant="outline" className="flex-1">
              Cancel
            </Button>
          </SheetClose>
          <Button className="flex-1" onClick={handleSubmit} disabled={isPending || isDeleting}>
            {isPending ? "Saving…" : "Save"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
