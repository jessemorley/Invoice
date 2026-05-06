"use client";

import { useState, useEffect, useTransition } from "react";
import type { Client, Invoice, InvoiceDetail, InvoiceStatus } from "@/lib/types";
import { formatAUD, formatRelativeTime } from "@/lib/format";
import { createInvoice, loadInvoiceDetail, updateInvoice, deleteInvoice, createLineItem, updateLineItem, deleteLineItem } from "@/app/(app)/invoices/actions";
import { invalidate } from "@/lib/invalidate";
import type { InvoiceFormData } from "@/app/(app)/invoices/actions";
import { ClientPicker } from "@/components/client-picker";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import type { ScheduledEmail } from "@/lib/queries";
import { Download, Mail, Plus, Trash2, CalendarClock, Clock, Send, X } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
      <div className="flex flex-row items-center gap-1.5 px-6 py-5 border-b">
        <SheetTitle className="flex-1">{mode === "add" ? "Add Line Item" : "Edit Line Item"}</SheetTitle>
        <SheetClose asChild>
          <Button variant="ghost" size="icon" className="shrink-0 size-8">
            <X className="size-5" />
            <span className="sr-only">Close</span>
          </Button>
        </SheetClose>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">Description</label>
          <Input className="text-sm" value={description} onChange={(e) => setDescription(e.target.value)} autoFocus />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">Quantity <span className="text-muted-foreground font-normal">(optional)</span></label>
          <Input type="number" className="text-sm" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">Amount ($)</label>
          <Input type="number" step="0.01" className="text-sm" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        {mode === "edit" && (
          <Button variant="ghost" className="w-full text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleDelete} disabled={isDeleting || isPending}>
            {isDeleting ? "Deleting…" : "Delete line"}
          </Button>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
      <SheetFooter className="px-6 py-4 border-t flex-row gap-2">
        <Button size="lg" variant="outline" className="flex-1" onClick={onCancel} disabled={isPending || isDeleting}>
          Cancel
        </Button>
        <Button size="lg" className="flex-1" onClick={handleSave} disabled={!canSave || isPending || isDeleting}>
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
  onViewEmail,
  onEntryClick,
  onLineItemMutate,
  clients,
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
  onViewEmail?: () => void;
  onEntryClick?: (entryId: string) => void;
  onLineItemMutate?: () => void;
  clients?: Client[];
}) {
  const [form, setForm] = useState<InvoiceFormData | null>(
    invoice ? defaultForm(invoice) : null
  );
  const [isPending, startTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [isCreating, startCreateTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  type SheetView = "client-pick" | "invoice" | "add-line-item" | { mode: "edit-line-item"; item: NonNullable<InvoiceDetail["line_items"][0]> };
  const [view, setView] = useState<SheetView>(invoice ? "invoice" : "client-pick");
  const [createdInvoice, setCreatedInvoice] = useState<Invoice | null>(null);
  const [localInvoiceDetail, setLocalInvoiceDetail] = useState<InvoiceDetail | null>(null);

  const activeInvoice = invoice ?? createdInvoice;
  const effectiveInvoiceDetail = invoice ? invoiceDetail : localInvoiceDetail;

  useEffect(() => {
    if (!open) return;
    setForm(invoice ? defaultForm(invoice) : null);
    setError(null);
    setCreatedInvoice(null);
    setLocalInvoiceDetail(null);
    setView(invoice ? "invoice" : "client-pick");
  }, [invoice, open]);

  function handleClientSelect(client: Client) {
    startCreateTransition(async () => {
      try {
        const newInvoice = await createInvoice(client.id);
        setCreatedInvoice(newInvoice);
        setForm(defaultForm(newInvoice));
        setLocalInvoiceDetail({
          id: newInvoice.id,
          number: newInvoice.number,
          issued_date: null,
          due_date: null,
          status: "draft",
          subtotal: 0,
          super_amount: 0,
          total: 0,
          notes: null,
          client: {
            id: client.id,
            name: client.name,
            color: client.color ?? "#9ca3af",
            address: client.address,
            suburb: client.suburb,
            email: client.email,
            abn: client.abn,
            contact_name: client.contact_name,
            entry_label: client.entry_label,
            pays_super: client.pays_super,
            super_rate: client.super_rate,
            show_super_on_invoice: client.show_super_on_invoice,
            rate_hourly: client.rate_hourly,
          },
          entries: [],
          line_items: [],
        });
        setView("invoice");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  async function refreshLocalDetail(invoiceId: string) {
    const detail = await loadInvoiceDetail(invoiceId);
    if (detail) {
      setLocalInvoiceDetail(detail);
      setCreatedInvoice((prev) => prev ? { ...prev, total: detail.total, super_amount: detail.super_amount } : prev);
    }
  }

  async function handleDownload() {
    if (!activeInvoice) return;
    setIsDownloading(true);
    try {
      const res = await fetch(`/api/invoices/${activeInvoice.id}/pdf`);
      const blob = await res.blob();
      const filename = res.headers.get("Content-Disposition")?.match(/filename="(.+?)"/)?.[1] ?? `Invoice ${activeInvoice.number}.pdf`;
      if (navigator.maxTouchPoints > 0 && navigator.canShare?.({ files: [new File([blob], filename, { type: "application/pdf" })] })) {
        await navigator.share({ files: [new File([blob], filename, { type: "application/pdf" })] }).catch((e) => {
          if (e?.name !== "AbortError") throw e;
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setIsDownloading(false);
    }
  }

  if (view !== "client-pick" && (!activeInvoice || !form)) return null;

  function set<K extends keyof InvoiceFormData>(key: K, value: InvoiceFormData[K]) {
    setForm((prev) => prev ? { ...prev, [key]: value } : prev);
  }

  function handleDelete() {
    if (!activeInvoice) return;
    startDeleteTransition(async () => {
      try {
        await deleteInvoice(activeInvoice.id);
        invalidate("invoices", "entries");
        onOpenChange(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  function handleSubmit() {
    if (!activeInvoice || !form) return;
    setError(null);
    startTransition(async () => {
      try {
        await updateInvoice(activeInvoice.id, form);
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
        {view === "client-pick" ? (
          <>
            <div className="flex flex-row items-center gap-1.5 px-4 py-4">
              <SheetTitle className="text-base flex-1">New invoice</SheetTitle>
              <SheetClose asChild>
                <Button variant="ghost" size="icon" className="shrink-0 size-8">
                  <X className="size-5" />
                  <span className="sr-only">Close</span>
                </Button>
              </SheetClose>
            </div>
            <div className="flex-1 overflow-y-auto">
              {isCreating ? (
                <div className="flex items-center justify-center h-32">
                  <Spinner />
                </div>
              ) : (
                <ClientPicker clients={clients ?? []} onSelect={handleClientSelect} />
              )}
            </div>
            {error && <p className="px-6 pb-4 text-sm text-destructive">{error}</p>}
          </>
        ) : view === "add-line-item" ? (
          <LineItemView
            mode="add"
            invoiceId={activeInvoice!.id}
            nextSortOrder={(effectiveInvoiceDetail?.line_items.length ?? 0) > 0
              ? Math.max(...(effectiveInvoiceDetail?.line_items.map(i => i.sort_order) ?? [0])) + 1
              : 0}
            onSave={() => {
              setView("invoice");
              if (!invoice && activeInvoice) refreshLocalDetail(activeInvoice.id);
              else onLineItemMutate?.();
            }}
            onCancel={() => setView("invoice")}
          />
        ) : typeof view === "object" && view.mode === "edit-line-item" ? (
          <LineItemView
            mode="edit"
            item={view.item}
            onSave={() => {
              setView("invoice");
              if (!invoice && activeInvoice) refreshLocalDetail(activeInvoice.id);
              else onLineItemMutate?.();
            }}
            onCancel={() => setView("invoice")}
          />
        ) : (
        <>
        <div className="flex flex-row items-center gap-1.5 px-6 py-5 border-b">
          <div className="flex flex-col gap-1.5 flex-1 min-w-0">
            <SheetTitle>{activeInvoice!.number}</SheetTitle>
            <div className="flex items-center gap-2">
              <div
                className="size-2.5 rounded-full shrink-0"
                style={{ backgroundColor: activeInvoice!.client.color }}
              />
              <p className="text-sm text-muted-foreground">{activeInvoice!.client.name}</p>
            </div>
          </div>
          <SheetClose asChild>
            <Button variant="ghost" size="icon" className="shrink-0 self-center size-8">
              <X className="size-5" />
              <span className="sr-only">Close</span>
            </Button>
          </SheetClose>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
          {/* Status */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Status</label>
            <ToggleGroup
              type="single"
              value={form!.status}
              onValueChange={(v) => v && set("status", v as InvoiceStatus)}
              variant="outline"
              className="w-full"
            >
              {(["draft", "issued", "paid"] as InvoiceStatus[]).map((s) => (
                <ToggleGroupItem key={s} value={s} className="flex-1">
                  {STATUS_LABEL[s]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          {/* Issued / Paid dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Issued</label>
              <div className="h-9 rounded-lg border border-input bg-transparent px-3 flex items-center">
                <input
                  type="date"
                  className="w-full bg-transparent outline-none text-sm text-foreground"
                  value={form!.issued_date}
                  onChange={(e) => set("issued_date", e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Paid</label>
              <div className="h-9 rounded-lg border border-input bg-transparent px-3 flex items-center">
                <input
                  type="date"
                  className="w-full bg-transparent outline-none text-sm text-foreground"
                  value={form!.paid_date}
                  onChange={(e) => set("paid_date", e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Lines</label>
              <Button variant="ghost" size="xs" className="gap-1 -mr-1" onClick={() => setView("add-line-item")}>
                <Plus className="size-3" />
                Add
              </Button>
            </div>
          <div className="rounded-lg bg-muted/40 px-4 py-3 flex flex-col gap-3 text-sm">
            {effectiveInvoiceDetail ? (
              <>
                {effectiveInvoiceDetail.entries.map((entry) => (
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
                {effectiveInvoiceDetail.line_items.map((item) => (
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
            {effectiveInvoiceDetail && (effectiveInvoiceDetail.entries.length > 0 || effectiveInvoiceDetail.line_items.length > 0) && (
              <Separator />
            )}
            <div className="flex justify-between font-medium">
              <span>Total</span>
              <span className="tabular-nums">
                {effectiveInvoiceDetail
                  ? formatAUD(
                      effectiveInvoiceDetail.entries.reduce((s, e) => s + e.base_amount + e.bonus_amount, 0) +
                      effectiveInvoiceDetail.line_items.reduce((s, i) => s + i.amount, 0) +
                      effectiveInvoiceDetail.super_amount
                    )
                  : formatAUD(activeInvoice!.total)}
              </span>
            </div>
            {activeInvoice!.super_amount > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>incl. super</span>
                <span className="tabular-nums">{formatAUD(activeInvoice!.super_amount)}</span>
              </div>
            )}
          </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" className="gap-1.5" disabled>
              <Plus className="size-3.5" />
              Add note
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownload} disabled={isDownloading}>
              {isDownloading ? <Spinner data-icon="inline-start" /> : <Download className="size-3.5" />}
              {isDownloading ? "Generating…" : "Download PDF"}
            </Button>
            {(!scheduledEmail || scheduledEmail.status === "cancelled" || scheduledEmail.status === "sent") ? (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={onSendClick}>
                <Mail className="size-3.5" />
                Email
              </Button>
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

        {scheduledEmail?.status === "sent" && (
          <div className="px-6 pb-4">
            <Alert>
              <Mail className="size-4" />
              <AlertTitle>Email sent {scheduledEmail.sent_at ? formatRelativeTime(scheduledEmail.sent_at) : ""}</AlertTitle>
              <AlertDescription>To {scheduledEmail.to_address}</AlertDescription>
              <AlertAction>
                <Button variant="outline" size="xs" onClick={onViewEmail}>View</Button>
              </AlertAction>
            </Alert>
          </div>
        )}

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
                <AlertDialogTitle>Delete {activeInvoice!.number}?</AlertDialogTitle>
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
            <Button size="lg" variant="outline" className="flex-1">
              Cancel
            </Button>
          </SheetClose>
          <Button size="lg" className="flex-1" onClick={handleSubmit} disabled={isPending || isDeleting}>
            {isPending ? "Saving…" : "Save"}
          </Button>
        </SheetFooter>
        </>
        )}
      </SheetContent>
    </Sheet>
  );
}
