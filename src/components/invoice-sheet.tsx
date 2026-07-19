"use client";

import { useState, useEffect, useTransition } from "react";
import type { Client, Invoice, InvoiceDetail, InvoiceStatus } from "@/lib/types";
import { formatAUD, formatRelativeTime } from "@/lib/format";
import { cn, lineItemTotal } from "@/lib/utils";
import { createInvoice, loadInvoiceDetail, updateInvoice, updateInvoiceNumber, deleteInvoice, createLineItem, updateLineItem, deleteLineItem } from "@/app/(app)/invoices/actions";
import { invalidate } from "@/lib/invalidate";
import type { InvoiceFormData } from "@/app/(app)/invoices/actions";
import { ClientPicker, ClientSearchInput } from "@/components/client-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ScheduledEmail } from "@/lib/queries";
import { Download, Mail, Plus, Trash2, CalendarClock, Send, X, MoreHorizontal } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
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
  AdaptiveSheet,
  AdaptiveSheetClose,
  AdaptiveSheetContent,
  AdaptiveSheetTitle,
} from "@/components/ui/adaptive-sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { SegmentedControl } from "@/components/ui/segmented-control";

type InvoiceEntry = InvoiceDetail["entries"][0];

function abbreviateRole(role?: string | null): string {
  switch (role?.toLowerCase()) {
    case "photographer": return "P";
    case "operator": return "O";
    default: return role ?? "";
  }
}

export function entryDescription(entry: InvoiceEntry): string {
  let label: string;
  if (entry.billing_type === "day_rate") {
    if (entry.workflow_type === "Own Brand") label = entry.brand ?? "Own Brand";
    else if (entry.workflow_type) label = entry.workflow_type;
    else label = "Creative Assist";
  } else if (entry.billing_type === "hourly") {
    const base = entry.label ?? entry.description ?? "";
    label = entry.role ? `${base} (${abbreviateRole(entry.role)})` : base;
  } else {
    const base = entry.label ?? entry.description ?? "";
    label = entry.skus != null ? `${base} × ${entry.skus}` : base;
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
  return {
    status: invoice.status,
    issued_date: invoice.issued_date ?? "",
    paid_date: invoice.paid_date ?? "",
    due_date: invoice.due_date ?? "",
    notes: invoice.notes ?? "",
  };
}

type LineItemViewProps =
  | { mode: "add"; invoiceId: string; nextSortOrder: number; item?: never; onSave: () => void; onCancel: () => void }
  | { mode: "edit"; invoiceId?: never; nextSortOrder?: never; item: { id: string; description: string; quantity: number | null; amount: number; details: string | null }; onSave: () => void; onCancel: () => void };

function LineItemView({ mode, invoiceId, nextSortOrder, item, onSave, onCancel }: LineItemViewProps) {
  const isMobile = useIsMobile();
  const [description, setDescription] = useState(mode === "edit" ? item.description : "");
  const [details, setDetails] = useState(mode === "edit" ? (item.details ?? "") : "");
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
        const detailsValue = details.trim() !== "" ? details.trim() : null;
        if (mode === "add") {
          await createLineItem(invoiceId, {
            description: description.trim(),
            details: detailsValue,
            quantity: quantity.trim() !== "" ? parseFloat(quantity) : null,
            amount: parseFloat(amount),
            sort_order: nextSortOrder,
          });
        } else {
          await updateLineItem(item.id, {
            description: description.trim(),
            details: detailsValue,
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

  const headerRow = (
    <div className={cn("flex flex-row items-center gap-1.5", isMobile ? "px-4 py-1" : "px-6 py-5 border-b")}>
      <AdaptiveSheetTitle className={cn("flex-1", isMobile && "text-sm text-center")}>
        {mode === "add" ? "Add Line Item" : "Edit Line Item"}
      </AdaptiveSheetTitle>
      {!isMobile && (
        <AdaptiveSheetClose asChild>
          <Button variant="ghost" size="icon" className="shrink-0 size-8">
            <X className="size-5" />
            <span className="sr-only">Close</span>
          </Button>
        </AdaptiveSheetClose>
      )}
    </div>
  );

  return (
    <>
      {!isMobile && headerRow}
      <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
        {isMobile && <div className="-mx-6 -mt-5">{headerRow}</div>}
        <div className="flex flex-col gap-2">
          <label htmlFor="li-description" className="text-sm font-medium">Description</label>
          <Input id="li-description" className="text-sm" value={description} onChange={(e) => setDescription(e.target.value)} autoFocus />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="li-details" className="text-sm font-medium">Details <span className="text-muted-foreground font-normal">(optional)</span></label>
          <Input id="li-details" className="text-sm" maxLength={200} value={details} onChange={(e) => setDetails(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="li-quantity" className="text-sm font-medium">Quantity <span className="text-muted-foreground font-normal">(optional)</span></label>
          <Input id="li-quantity" type="number" className="text-sm" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="li-amount" className="text-sm font-medium">Amount ($)</label>
          <Input id="li-amount" type="number" step="0.01" className="text-sm" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        {mode === "edit" && (
          <Button variant="ghost" className="w-full text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleDelete} disabled={isDeleting || isPending}>
            {isDeleting ? "Deleting…" : "Delete line"}
          </Button>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
      <div className="px-4 py-3 flex gap-2">
        <Button size="lg" variant="outline" className="h-9 flex-1 rounded-2xl" onClick={onCancel} disabled={isPending || isDeleting}>
          Cancel
        </Button>
        <Button size="lg" className="h-9 flex-1 rounded-2xl" onClick={handleSave} disabled={!canSave || isPending || isDeleting}>
          {isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </>
  );
}

export function InvoiceSheet({
  open,
  onOpenChangeAction,
  invoice,
  invoiceDetail,
  scheduledEmail,
  onSendClick,
  onCancelEmail,
  onEditEmail,
  onReschedule,
  onSendNow,
  onViewEmail,
  onEntryClick,
  onLineItemMutate,
  clients,
}: {
  open: boolean;
  onOpenChangeAction: (open: boolean) => void;
  invoice: Invoice | null;
  invoiceDetail?: InvoiceDetail | null;
  scheduledEmail?: ScheduledEmail | null;
  onSendClick?: () => void;
  onCancelEmail?: (id: string) => void;
  onEditEmail?: () => void;
  onReschedule?: () => void;
  onSendNow?: (id: string) => void;
  onViewEmail?: () => void;
  onEntryClick?: (entryId: string) => void;
  onLineItemMutate?: () => void;
  clients?: Client[];
}) {
  const isMobile = useIsMobile();
  const [form, setForm] = useState<InvoiceFormData | null>(
    invoice ? defaultForm(invoice) : null
  );
  const [isPending, startTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [isCreating, startCreateTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [editingNumber, setEditingNumber] = useState(false);
  const [numberDraft, setNumberDraft] = useState("");
  const [localNumber, setLocalNumber] = useState<string | null>(null);
  const [isSavingNumber, startSaveNumberTransition] = useTransition();
  const [numberError, setNumberError] = useState<string | null>(null);
  type SheetView = "client-pick" | "invoice" | "add-line-item" | { mode: "edit-line-item"; item: NonNullable<InvoiceDetail["line_items"][0]> };
  const [view, setView] = useState<SheetView>(invoice ? "invoice" : "client-pick");
  const [clientQuery, setClientQuery] = useState("");
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
    setClientQuery("");
    setEditingNumber(false);
    setNumberDraft("");
    setLocalNumber(null);
    setNumberError(null);
  }, [invoice, open]);

  function handleClientSelect(client: Client) {
    setClientQuery("");
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
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsDownloading(false);
    }
  }

  if (view !== "client-pick" && (!activeInvoice || !form)) return null;

  function set<K extends keyof InvoiceFormData>(key: K, value: InvoiceFormData[K]) {
    setForm((prev) => prev ? { ...prev, [key]: value } : prev);
  }

  function handleNumberSave() {
    const trimmed = numberDraft.trim();
    const currentNumber = localNumber ?? activeInvoice?.number ?? "";
    if (!trimmed || trimmed === currentNumber) {
      setEditingNumber(false);
      return;
    }
    if (!activeInvoice) return;
    setNumberError(null);
    startSaveNumberTransition(async () => {
      try {
        await updateInvoiceNumber(activeInvoice.id, trimmed);
        setLocalNumber(trimmed);
        setEditingNumber(false);
        invalidate("invoices");
      } catch (e) {
        setNumberError(e instanceof Error ? e.message : "Could not update invoice number");
        setEditingNumber(false);
      }
    });
  }

  function handleDelete() {
    if (!activeInvoice) return;
    startDeleteTransition(async () => {
      try {
        await deleteInvoice(activeInvoice.id);
        invalidate("invoices", "entries");
        onOpenChangeAction(false);
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
        onOpenChangeAction(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  // On mobile the drawer has no fixed header: it scrolls with the content,
  // and dismissal is swipe-down/overlay instead of an X.
  const invoiceHeaderRow = activeInvoice && form && (
    <div className={cn("px-4", !isMobile && "border-b")}>
      <div className={cn("flex flex-row items-center gap-1.5", isMobile ? "py-1" : "h-14")}>
        {editingNumber ? (
          <>
            <AdaptiveSheetTitle className="sr-only">{localNumber ?? activeInvoice.number}</AdaptiveSheetTitle>
            <input
              autoFocus
              className={cn("font-semibold bg-transparent outline-none flex-1 min-w-0", isMobile ? "text-sm text-center" : "text-lg")}
              value={numberDraft}
              disabled={isSavingNumber}
              onChange={(e) => setNumberDraft(e.target.value)}
              onBlur={handleNumberSave}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.currentTarget.blur(); }
                if (e.key === "Escape") { setEditingNumber(false); setNumberError(null); }
              }}
            />
          </>
        ) : (
          <AdaptiveSheetTitle className={cn("flex-1 min-w-0", isMobile ? "text-sm text-center" : "text-lg")}>
            <button
              className="hover:opacity-70 transition-opacity max-w-full truncate align-middle"
              onClick={() => { setNumberDraft(localNumber ?? activeInvoice.number); setEditingNumber(true); setNumberError(null); }}
              aria-label="Edit invoice number"
            >
              {isSavingNumber ? "Saving…" : `${localNumber ?? activeInvoice.number} - ${activeInvoice.client.name}`}
            </button>
          </AdaptiveSheetTitle>
        )}
        {!isMobile && (
          <AdaptiveSheetClose asChild>
            <Button variant="ghost" size="icon" className="shrink-0 size-8">
              <X className="size-5" />
              <span className="sr-only">Close</span>
            </Button>
          </AdaptiveSheetClose>
        )}
      </div>
      {numberError && <p className={cn("text-xs text-destructive pb-2", isMobile && "text-center")}>{numberError}</p>}
    </div>
  );

  const pickHeaderRow = (
    <div className={cn("flex flex-row items-center gap-1.5 px-4", isMobile ? "py-1" : "h-14 border-b")}>
      <ClientSearchInput
        placeholder="New invoice"
        value={clientQuery}
        onChange={setClientQuery}
      />
      {!isMobile && (
        <AdaptiveSheetClose asChild>
          <Button variant="ghost" size="icon" className="shrink-0 size-8">
            <X className="size-5" />
            <span className="sr-only">Close</span>
          </Button>
        </AdaptiveSheetClose>
      )}
    </div>
  );

  return (
    <AdaptiveSheet open={open} onOpenChange={onOpenChangeAction}>
      <AdaptiveSheetContent side="right" className="w-full md:max-w-md flex flex-col gap-0 p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
        {view === "client-pick" ? (
          <>
            {!isMobile && pickHeaderRow}
            <div className="flex-1 overflow-y-auto">
              {isMobile && pickHeaderRow}
              {isCreating ? (
                <div className="flex items-center justify-center h-32">
                  <Spinner />
                </div>
              ) : (
                <ClientPicker clients={clients ?? []} query={clientQuery} onSelectAction={handleClientSelect} />
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
        {!isMobile && invoiceHeaderRow}

        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
          {isMobile && <div className="-mx-6 -mt-5 -mb-2">{invoiceHeaderRow}</div>}
          {/* Status */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Status</label>
            <SegmentedControl
              value={form!.status}
              onValueChange={(v) => set("status", v)}
              options={(["draft", "issued", "paid"] as InvoiceStatus[]).map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
            />
          </div>

          {/* Issued / Paid dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Issued</label>
              <DateTimeInput type="date" value={form!.issued_date} onChange={(v) => set("issued_date", v)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Paid</label>
              <DateTimeInput type="date" value={form!.paid_date} onChange={(v) => set("paid_date", v)} />
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
          <div className="rounded-lg border overflow-hidden flex flex-col text-sm">
            {effectiveInvoiceDetail ? (
              <>
                {effectiveInvoiceDetail.entries.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => onEntryClick?.(entry.id)}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left border-b"
                  >
                    <span className="text-muted-foreground shrink-0 tabular-nums">
                      {new Date(entry.date + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                    </span>
                    <span className="flex-1 truncate">{entryDescription(entry)}</span>
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
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left border-b"
                  >
                    <span className="flex-1 truncate">
                      {item.quantity != null && <span className="tabular-nums text-muted-foreground">{item.quantity} × </span>}
                      {item.description}
                    </span>
                    <span className="tabular-nums shrink-0">{formatAUD(lineItemTotal(item))}</span>
                  </button>
                ))}
              </>
            ) : (
              <>
                <div className="flex justify-between gap-4 px-4 py-3 border-b">
                  <div className="h-4 w-32 rounded bg-muted animate-pulse" />
                  <div className="h-4 w-16 rounded bg-muted animate-pulse" />
                </div>
                <div className="flex justify-between gap-4 px-4 py-3 border-b">
                  <div className="h-4 w-24 rounded bg-muted animate-pulse" />
                  <div className="h-4 w-16 rounded bg-muted animate-pulse" />
                </div>
              </>
            )}
            {activeInvoice!.super_amount > 0 && (
              <div className="flex justify-between text-muted-foreground px-4 py-3 border-b">
                <span>Super</span>
                <span className="tabular-nums">{formatAUD(activeInvoice!.super_amount)}</span>
              </div>
            )}
            <div className="flex justify-between font-medium px-4 py-3">
              <span>Total</span>
              <span className="tabular-nums">
                {effectiveInvoiceDetail
                  ? formatAUD(
                      effectiveInvoiceDetail.entries.reduce((s, e) => s + e.base_amount + e.bonus_amount, 0) +
                      effectiveInvoiceDetail.line_items.reduce((s, i) => s + lineItemTotal(i), 0)
                    )
                  : formatAUD(activeInvoice!.subtotal)}
              </span>
            </div>
          </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownload} disabled={isDownloading}>
              {isDownloading ? <Spinner data-icon="inline-start" /> : <Download className="size-3.5" />}
              {isDownloading ? "Generating…" : "Download PDF"}
            </Button>
            {(!scheduledEmail || scheduledEmail.status === "cancelled") && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={onSendClick}>
                <Mail className="size-3.5" />
                Email
              </Button>
            )}
            {(scheduledEmail?.status === "failed" || scheduledEmail?.status === "bounced") && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-destructive border-destructive/40 hover:text-destructive"
                onClick={onSendClick}
              >
                <Mail className="size-3.5" />
                {scheduledEmail.status === "bounced" ? "Bounced" : "Failed"} — Retry
              </Button>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {(scheduledEmail?.status === "pending" || scheduledEmail?.status === "sent") && (
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Email</label>
                {scheduledEmail.status === "pending" ? (
                  <div className="flex items-center justify-between h-9 px-3 rounded-lg border border-border text-sm">
                    <span className="text-muted-foreground truncate min-w-0">{scheduledEmail.to_address}</span>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-xs text-muted-foreground">{formatScheduledFor(scheduledEmail.scheduled_for)}</span>
                      <Badge variant="outline">scheduled</Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-7 shrink-0 -mr-1">
                            <MoreHorizontal className="size-4" />
                            <span className="sr-only">Email actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={onEditEmail}>
                            <Mail className="size-4" />
                            Edit email
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={onReschedule}>
                            <CalendarClock className="size-4" />
                            Reschedule
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onSendNow?.(scheduledEmail.id)}>
                            <Send className="size-4" />
                            Send now
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => onCancelEmail?.(scheduledEmail.id)}
                          >
                            Cancel send
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between h-9 px-3 rounded-lg border border-border text-sm">
                    <span className="text-muted-foreground truncate min-w-0">{scheduledEmail.to_address}</span>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-xs text-muted-foreground">{scheduledEmail.sent_at ? formatRelativeTime(scheduledEmail.sent_at) : ""}</span>
                      <Badge variant="secondary">sent</Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-7 shrink-0 -mr-1">
                            <MoreHorizontal className="size-4" />
                            <span className="sr-only">Email actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={onViewEmail}>
                            View email
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={onSendClick}>
                            <Mail className="size-4" />
                            Send again
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                )}
            </div>
          )}
        </div>

        <div className="px-4 py-3 flex gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                size="icon-lg"
                className="h-9 shrink-0 rounded-2xl"
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
                <AlertDialogAction variant="destructive" onClick={handleDelete}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <AdaptiveSheetClose asChild>
            <Button size="lg" variant="outline" className="h-9 flex-1 rounded-2xl">
              Cancel
            </Button>
          </AdaptiveSheetClose>
          <Button size="lg" className="h-9 flex-1 rounded-2xl" onClick={handleSubmit} disabled={isPending || isDeleting}>
            {isPending ? "Saving…" : "Save"}
          </Button>
        </div>
        </>
        )}
      </AdaptiveSheetContent>
    </AdaptiveSheet>
  );
}
