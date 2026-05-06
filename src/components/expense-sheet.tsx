"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import type { Expense, ExpenseCategory } from "@/lib/types";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/mock-data";
import {
  createExpense,
  updateExpense,
  deleteExpense,
  getReceiptUrl,
  deleteReceipt,
} from "@/app/(app)/expenses/actions";
import type { ExpenseFormData } from "@/app/(app)/expenses/actions";
import { formatAUD, formatDateShort } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import { Paperclip, Trash2, X } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

const TODAY = new Date().toLocaleDateString("en-CA");

function defaultForm(expense: Expense | null): ExpenseFormData {
  if (expense) {
    return {
      date: expense.date,
      category: expense.category,
      description: expense.description,
      amount: expense.amount,
      gst_included: expense.gst_included,
      notes: expense.notes ?? null,
      is_billable: expense.is_billable,
    };
  }
  return {
    date: TODAY,
    category: "other",
    description: "",
    amount: 0,
    gst_included: false,
    notes: null,
    is_billable: false,
  };
}

export function ExpenseSheet({
  open,
  onOpenChange,
  expense,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense: Expense | null;
}) {
  const [form, setForm] = useState<ExpenseFormData>(defaultForm(expense));
  const [isPending, startTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Receipt state
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [removeReceipt, setRemoveReceipt] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setForm(defaultForm(expense));
    setError(null);
    setPendingFile(null);
    setRemoveReceipt(false);
  }, [expense, open]);

  function set<K extends keyof ExpenseFormData>(key: K, value: ExpenseFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // The filename shown in the UI: pending file takes priority, then existing path
  const existingPath = removeReceipt ? null : (expense?.receipt_path ?? null);
  const displayFilename = pendingFile
    ? pendingFile.name
    : existingPath
    ? existingPath.split("/").pop()!
    : null;
  const canView = !pendingFile && !!existingPath;

  async function uploadFile(expenseId: string, file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/expenses/${expenseId}/receipt`, {
      method: "POST",
      body: fd,
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json.error ?? "Upload failed");
    }
  }

  async function handleViewReceipt() {
    if (!existingPath) return;
    try {
      const url = await getReceiptUrl(existingPath);
      window.open(url, "_blank");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open receipt");
    }
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        if (expense) {
          // Handle receipt changes before updating fields
          if (removeReceipt && expense.receipt_path) {
            await deleteReceipt(expense.id, expense.receipt_path);
          }
          if (pendingFile) {
            setIsUploading(true);
            await uploadFile(expense.id, pendingFile);
            setIsUploading(false);
          }
          await updateExpense(expense.id, form);
        } else {
          // Create first to get an id, then upload
          const newId = await createExpense(form);
          if (pendingFile && newId) {
            setIsUploading(true);
            await uploadFile(newId, pendingFile);
            setIsUploading(false);
          }
        }
        onOpenChange(false);
      } catch (e) {
        setIsUploading(false);
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  function handleDelete() {
    if (!expense) return;
    setError(null);
    startDeleteTransition(async () => {
      try {
        await deleteExpense(expense.id);
        onOpenChange(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  const gst = form.gst_included && form.amount > 0 ? form.amount / 11 : null;
  const busy = isPending || isDeleting || isUploading;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col gap-0 p-0">
        <div className="flex flex-row items-center gap-1.5 px-6 py-5 border-b">
          <div className="flex flex-col gap-1.5 flex-1 min-w-0">
            <SheetTitle>
              {expense ? expense.description || "Edit expense" : "New expense"}
            </SheetTitle>
            {expense && (
              <p className="text-sm text-muted-foreground">{formatDateShort(expense.date)}</p>
            )}
          </div>
          <SheetClose asChild>
            <Button variant="ghost" size="icon" className="shrink-0 self-center size-8">
              <X className="size-5" />
              <span className="sr-only">Close</span>
            </Button>
          </SheetClose>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
          {/* Date */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Date</label>
            <Input
              type="date"
              className="text-sm"
              value={form.date}
              onChange={(e) => set("date", e.target.value)}
            />
          </div>

          {/* Category */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Category</label>
            <Select
              value={form.category}
              onValueChange={(v) => set("category", v as ExpenseCategory)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[]).map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {EXPENSE_CATEGORY_LABELS[cat]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Description</label>
            <Input
              className="text-sm"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="What was this expense for?"
            />
          </div>

          {/* Amount */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Amount</label>
            <Input
              type="number"
              step="0.01"
              min="0"
              className="text-sm"
              value={form.amount || ""}
              onChange={(e) => set("amount", parseFloat(e.target.value) || 0)}
              placeholder="0.00"
            />
          </div>

          {/* GST */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">GST included</label>
            <Switch
              checked={form.gst_included}
              onCheckedChange={(v) => set("gst_included", v)}
            />
          </div>

          {/* GST summary */}
          {gst !== null && (
            <div className="rounded-lg bg-muted/40 px-4 py-3 flex flex-col gap-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>GST component</span>
                <span className="tabular-nums">{formatAUD(gst)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-medium">
                <span>Ex-GST</span>
                <span className="tabular-nums">{formatAUD(form.amount - gst)}</span>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Notes</label>
            <Textarea
              className="text-sm"
              value={form.notes ?? ""}
              onChange={(e) => set("notes", e.target.value || null)}
              placeholder="Optional notes…"
              rows={3}
            />
          </div>

          {/* Receipt */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Receipt</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setPendingFile(file);
                setRemoveReceipt(false);
                e.target.value = "";
              }}
            />
            {displayFilename ? (
              <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2.5">
                <Paperclip className="size-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 text-sm truncate">{displayFilename}</span>
                {canView && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto py-0.5 px-2 text-xs"
                    onClick={handleViewReceipt}
                  >
                    View
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto py-0.5 px-2 text-xs text-destructive hover:text-destructive"
                  onClick={() => {
                    setPendingFile(null);
                    setRemoveReceipt(true);
                  }}
                >
                  Remove
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="justify-start gap-2 text-muted-foreground"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="size-4" />
                Attach receipt…
              </Button>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <SheetFooter className="px-6 py-4 border-t flex-row gap-2">
          {expense && (
            <Button
              variant="ghost"
              size="icon-lg"
              className="text-destructive hover:text-destructive"
              onClick={handleDelete}
              disabled={busy}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
          <SheetClose asChild>
            <Button size="lg" variant="outline" className="flex-1" disabled={busy}>
              Cancel
            </Button>
          </SheetClose>
          <Button size="lg" className="flex-1" onClick={handleSave} disabled={busy}>
            {busy && <Spinner />}
            {isUploading ? "Uploading…" : isPending ? "Saving…" : "Save"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
