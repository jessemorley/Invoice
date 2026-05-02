"use client";

import { useState, useEffect, useTransition } from "react";
import type { Invoice, InvoiceDetail, InvoiceStatus } from "@/lib/types";
import { formatAUD, formatDateShort } from "@/lib/format";
import { updateInvoice, deleteInvoice, createLineItem, updateLineItem, deleteLineItem } from "@/app/(app)/invoices/actions";
import { invalidate } from "@/lib/invalidate";
import type { InvoiceFormData } from "@/app/(app)/invoices/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import type { ScheduledEmail } from "@/lib/queries";
import { Download, Mail, Plus, Trash2, CalendarClock, Clock, Send } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";

type InvoiceEntry = InvoiceDetail["entries"][0];

function abbreviateRole(role?: string | null): string {
  switch (role?.toLowerCase()) {
    case "photographer": return "P";
    case "operator": return "O";
    default: return role ?? "";
  }
}

function entryDescription(entry: InvoiceEntry): string {
  let label: string;
  if (entry.billing_type === "day_rate") {
    if (entry.workflow_type === "Own Brand") label = entry.brand ?? "Own Brand";
    else if (entry.workflow_type) label = entry.workflow_type;
    else label = "Creative Assist";
  } else if (entry.billing_type === "hourly") {
    const base = entry.shoot_client ?? entry.description ?? "";
    label = entry.role ? `${base} (${abbreviateRole(entry.role)})` : base;
  } else {
    label = entry.description ?? "";
  }
  return label;
}

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: "Draft",
  issued: "Issued",
  paid: "Paid",
};

function formatScheduledFor(isoString: string): string {
  const d = new Date(isoString);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const isTomorrow = d.toDateString() === new Date(now.getTime() + 86400000).toDateString();
  const time = d.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", hour12: true });
  if (d < now) return `Sending soon`;
  if (isToday) return `Today at ${time}`;
  if (isTomorrow) return `Tomorrow at ${time}`;
  const date = d.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
  return `${date} at ${time}`;
}

function defaultForm(invoice: Invoice): InvoiceFormData {
  const inv = invoice as Invoice & { due_date?: string | null; notes?: string | null };
  return {
    status: inv.status,
    issued_date: inv.issued_date ?? "",
    paid_date: inv.paid_date ?? "",
    due_date: inv.due_date ?? "",
    notes: inv.notes ?? "",
  };
}

type LineItemViewProps =
  | { mode: "add"; invoiceId: string; nextSortOrder: number; item?: never; onSave: () => void; onCancel: () => void }
  | { mode: "edit"; invoiceId?: never; nextSortOrder?: never; item: { id: string; description: string; quantity: number | null; amount: number }; onSave: () => void; onCancel: () => void };

function LineItemView({ mode, invoiceId, nextSortOrder, item, onSave, onCancel }: LineItemViewProps) {
  const [description, setDescription] = useState(mode === "edit" ? item.description : "");
  const [quantity, setQuantity] = useState(mode === "edit" && item.quantity != null ? String(item.quantity) : "");
  const [amount, setAmount] = useState(mode === "edit" ? String(item.amount) : "");
  const [isPending, startTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const canSave = description.trim() !== "" && amount.trim() !== "" && !isNaN(parseFloat(amount));

  function handleSave() {
    if (!canSave) return;
    setError(null);
    startTransition(async () => {
      try {
        if (mode === "add") {
          await createLineItem(invoiceId, {
            description: description.trim(),
            quantity: quantity.trim() !== "" ? parseFloat(quantity) : null,
            amount: parseFloat(amount),
            sort_order: nextSortOrder,
          });
        } else {
          await updateLineItem(item.id, {
            description: description.trim(),
            quantity: quantity.trim() !== "" ? parseFloat(quantity) : null,
            amount: parseFloat(amount),
          });
        }
        invalidate("invoices");
        onSave();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  function handleDelete() {
    if (mode !== "edit") return;
    startDeleteTransition(async () => {
      try {
        await deleteLineItem(item.id);
        invalidate("invoices");
        onSave();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  return (
    <>
      <SheetHeader className="px-6 py-5 border-b">
        <SheetTitle>{mode === "add" ? "Add Line Item" : "Edit Line Item"}</SheetTitle>
      </SheetHeader>
      <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">Description</label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} autoFocus />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">Quantity <span className="text-muted-foreground font-normal">(optional)</span></label>
          <Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">Amount ($)</label>
          <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
      <SheetFooter className="px-6 py-4 border-t flex-row gap-2">
        {mode === "edit" && (
          <Button variant="destructive" size="icon" className="shrink-0" onClick={handleDelete} disabled={isDeleting || isPending}>
            <Trash2 className="size-4" />
          </Button>
        )}
        <Button variant="outline" className="flex-1" onClick={onCancel} disabled={isPending || isDeleting}>
          Cancel
        </Button>
        <Button className="flex-1" onClick={handleSave} disabled={!canSave || isPending || isDeleting}>
          {isPending ? "Saving…" : "Save"}
        </Button>
      </SheetFooter>
    </>
  );
}

export function InvoiceSheet({
  open,
  onOpenChange,
  invoice,
  invoiceDetail,
  scheduledEmail,
  onSendClick,
  onCancelEmail,
  onReschedule,
  onSendNow,
  onEntryClick,
  onLineItemMutate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice | null;
  invoiceDetail?: InvoiceDetail | null;
  scheduledEmail?: ScheduledEmail | null;
  onSendClick?: () => void;
  onCancelEmail?: (id: string) => void;
  onReschedule?: () => void;
  onSendNow?: (id: string) => void;
  onEntryClick?: (entryId: string) => void;
  onLineItemMutate?: () => void;
}) {
  const [form, setForm] = useState<InvoiceFormData | null>(
    invoice ? defaultForm(invoice) : null
  );
  const [isPending, startTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  type SheetView = "invoice" | "add-line-item" | { mode: "edit-line-item"; item: NonNullable<InvoiceDetail["line_items"][0]> };
  const [view, setView] = useState<SheetView>("invoice");

  useEffect(() => {
    setForm(invoice ? defaultForm(invoice) : null);
    setError(null);
    setView("invoice");
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
        {view === "add-line-item" ? (
          <LineItemView
            mode="add"
            invoiceId={invoice.id}
            nextSortOrder={(invoiceDetail?.line_items.length ?? 0) > 0
              ? Math.max(...(invoiceDetail?.line_items.map(i => i.sort_order) ?? [0])) + 1
              : 0}
            onSave={() => { setView("invoice"); onLineItemMutate?.(); }}
            onCancel={() => setView("invoice")}
          />
        ) : typeof view === "object" && view.mode === "edit-line-item" ? (
          <LineItemView
            mode="edit"
            item={view.item}
            onSave={() => { setView("invoice"); onLineItemMutate?.(); }}
            onCancel={() => setView("invoice")}
          />
        ) : (
        <>
        <SheetHeader className="px-6 py-5 border-b">
          <SheetTitle>{invoice.number}</SheetTitle>
          <div className="flex items-center gap-2">
            <div
              className="size-2.5 rounded-full shrink-0"
              style={{ backgroundColor: invoice.client.color }}
            />
            <p className="text-sm text-muted-foreground">{invoice.client.name}</p>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
          {/* Summary */}
          <div className="rounded-lg bg-muted/40 px-4 py-3 flex flex-col gap-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium text-xs uppercase tracking-wide text-muted-foreground">Lines</span>
              <Button variant="ghost" size="xs" className="gap-1 -mr-1" onClick={() => setView("add-line-item")}>
                <Plus className="size-3" />
                Add
              </Button>
            </div>
            {invoiceDetail ? (
              <>
                {invoiceDetail.entries.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => onEntryClick?.(entry.id)}
                    className="flex items-center gap-4 -mx-2 px-2 py-1 rounded-md hover:bg-muted/60 transition-colors text-left w-[calc(100%+1rem)]"
                  >
                    <div className="flex flex-col gap-0.5 flex-1">
                      <span className="font-medium">{entryDescription(entry)}</span>
                      <span className="text-muted-foreground">
                        {new Date(entry.date + "T00:00:00").toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })}
                      </span>
                    </div>
                    {entry.hours_worked != null && (
                      <span className="tabular-nums text-muted-foreground shrink-0">{entry.hours_worked}h</span>
                    )}
                    <span className="tabular-nums shrink-0">{formatAUD(entry.base_amount)}</span>
                  </button>
                ))}
                {invoiceDetail.line_items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setView({ mode: "edit-line-item", item })}
                    className="flex justify-between gap-4 -mx-2 px-2 py-1 rounded-md hover:bg-muted/60 transition-colors text-left w-[calc(100%+1rem)]"
                  >
                    <span className="text-muted-foreground">{item.description}</span>
                    <span className="tabular-nums shrink-0">{formatAUD(item.amount)}</span>
                  </button>
                ))}
              </>
            ) : (
              <>
                <div className="flex justify-between gap-4">
                  <div className="h-4 w-32 rounded bg-muted animate-pulse" />
                  <div className="h-4 w-16 rounded bg-muted animate-pulse" />
                </div>
                <div className="flex justify-between gap-4">
                  <div className="h-4 w-24 rounded bg-muted animate-pulse" />
                  <div className="h-4 w-16 rounded bg-muted animate-pulse" />
                </div>
              </>
            )}
            <Separator />
            <div className="flex justify-between font-medium">
              <span>Total</span>
              <span className="tabular-nums">
                {invoiceDetail
                  ? formatAUD(
                      invoiceDetail.entries.reduce((s, e) => s + e.base_amount + e.bonus_amount, 0) +
                      invoiceDetail.line_items.reduce((s, i) => s + i.amount, 0) +
                      invoiceDetail.super_amount
                    )
                  : formatAUD(invoice.total)}
              </span>
            </div>
            {invoice.super_amount > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>incl. super</span>
                <span className="tabular-nums">{formatAUD(invoice.super_amount)}</span>
              </div>
            )}
          </div>

          {/* Status */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Status</label>
            <div className="grid grid-cols-3 rounded-md border overflow-hidden">
              {(["draft", "issued", "paid"] as InvoiceStatus[]).map((s, i) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => set("status", s)}
                  className={[
                    "py-1.5 text-sm font-medium transition-colors",
                    i > 0 ? "border-l" : "",
                    form.status === s
                      ? s === "draft"
                        ? "bg-secondary text-secondary-foreground"
                        : s === "issued"
                        ? "bg-secondary text-secondary-foreground"
                        : "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted/50",
                  ].join(" ")}
                >
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Issued / Paid dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2 min-w-0">
              <label className="text-sm font-medium">Issued</label>
              <Input
                type="date"
                value={form.issued_date}
                onChange={(e) => set("issued_date", e.target.value)}
                className="w-full"
              />
            </div>
            <div className="flex flex-col gap-2 min-w-0">
              <label className="text-sm font-medium">Paid</label>
              <Input
                type="date"
                value={form.paid_date}
                onChange={(e) => set("paid_date", e.target.value)}
                className="w-full"
              />
            </div>
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

          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" asChild className="gap-1.5">
              <a href={`/api/invoices/${invoice.id}/pdf`} download>
                <Download className="size-3.5" />
                Download PDF
              </a>
            </Button>
            {(!scheduledEmail || scheduledEmail.status === "cancelled") ? (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={onSendClick}>
                <Mail className="size-3.5" />
                Email
              </Button>
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

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        {scheduledEmail?.status === "pending" && (
          <div className="px-6 pb-4">
            <Alert className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-50">
              <Clock className="size-4" />
              <AlertTitle>Email scheduled for {formatScheduledFor(scheduledEmail.scheduled_for)}</AlertTitle>
              <AlertDescription className="text-amber-800 dark:text-amber-200">
                <div className="flex gap-2 flex-wrap mt-2">
                  <Button variant="outline" size="xs" onClick={onReschedule}>
                    <CalendarClock />
                    Edit
                  </Button>
                  <Button variant="outline" size="xs" onClick={() => onSendNow?.(scheduledEmail.id)}>
                    <Send />
                    Send now
                  </Button>
                  <Button variant="destructive" size="xs" onClick={() => onCancelEmail?.(scheduledEmail.id)}>
                    Cancel
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          </div>
        )}

        <SheetFooter className="px-6 py-4 border-t flex-row gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                size="icon"
                className="shrink-0"
                disabled={isDeleting || isPending}
              >
                <Trash2 className="size-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {invoice.number}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete the invoice and all its line items. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <SheetClose asChild>
            <Button variant="outline" className="flex-1">
              Cancel
            </Button>
          </SheetClose>
          <Button className="flex-1" onClick={handleSubmit} disabled={isPending || isDeleting}>
            {isPending ? "Saving…" : "Save"}
          </Button>
        </SheetFooter>
        </>
        )}
      </SheetContent>
    </Sheet>
  );
}
