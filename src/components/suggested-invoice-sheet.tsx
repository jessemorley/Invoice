"use client";

import { useState, useEffect, useTransition } from "react";
import type { SuggestedInvoice } from "@/lib/queries";
import type { InvoiceEntry } from "@/lib/types";
import type { GeneratedInvoice } from "@/app/(app)/invoices/actions";
import { loadSuggestedInvoiceEntries, generateInvoices } from "@/app/(app)/invoices/actions";
import { invalidate } from "@/lib/invalidate";
import { formatAUD } from "@/lib/format";
import { entryDescription } from "@/components/invoice-sheet";
import { ClientSquircle } from "@/components/client-squircle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { X } from "lucide-react";
import {
  AdaptiveSheet,
  AdaptiveSheetClose,
  AdaptiveSheetContent,
  AdaptiveSheetTitle,
} from "@/components/ui/adaptive-sheet";

export function SuggestedInvoiceSheet({
  open,
  onOpenChangeAction,
  group,
  onCreatedAction,
  onEntryClick,
}: {
  open: boolean;
  onOpenChangeAction: (open: boolean) => void;
  group: SuggestedInvoice | null;
  onCreatedAction: (invoice: GeneratedInvoice) => void;
  onEntryClick?: (entryId: string) => void;
}) {
  const isMobile = useIsMobile();
  const [entries, setEntries] = useState<InvoiceEntry[] | null>(null);
  const [, startLoad] = useTransition();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !group) return;
    startLoad(async () => {
      setEntries(null);
      setError(null);
      try {
        setEntries(await loadSuggestedInvoiceEntries(group.clientId, group.isoWeek));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load entries");
      }
    });
  }, [open, group, startLoad]);

  function handleCreate() {
    if (!group) return;
    setError(null);
    startTransition(async () => {
      try {
        const { invoices } = await generateInvoices([group.key]);
        invalidate("invoices", "entries");
        onOpenChangeAction(false);
        if (invoices[0]) onCreatedAction(invoices[0]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  const superAmount = entries?.reduce((s, e) => s + e.super_amount, 0) ?? 0;
  const subtotal = entries?.reduce((s, e) => s + e.base_amount + e.bonus_amount, 0) ?? group?.subtotal ?? 0;

  return (
    <AdaptiveSheet open={open} onOpenChange={onOpenChangeAction}>
      <AdaptiveSheetContent side="right" className="w-full md:max-w-md flex flex-col gap-0 p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
        <div className={cn("px-4", !isMobile && "border-b")}>
          <div className={cn("flex flex-row items-center gap-2", isMobile ? "py-1 justify-center" : "h-14")}>
            {group && <ClientSquircle name={group.clientName} color={group.clientColor} className="size-6" />}
            <AdaptiveSheetTitle className={cn("min-w-0 truncate", isMobile ? "text-sm text-center" : "text-lg flex-1")}>
              {group ? `Suggested — ${group.clientName}` : "Suggested invoice"}
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
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
          <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">Lines</label>
          <div className="rounded-lg border overflow-hidden flex flex-col text-sm">
            {entries ? (
              entries.map((entry) => (
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
              ))
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
            {superAmount > 0 && (
              <div className="flex justify-between text-muted-foreground px-4 py-3 border-b">
                <span>Super</span>
                <span className="tabular-nums">{formatAUD(superAmount)}</span>
              </div>
            )}
            <div className="flex justify-between font-medium px-4 py-3">
              <span>Total</span>
              <span className="tabular-nums">{formatAUD(subtotal)}</span>
            </div>
          </div>
          </div>
        </div>

        <div className="border-t px-4 py-3 flex flex-col gap-2">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button size="lg" onClick={handleCreate} disabled={isPending || !group}>
            {isPending ? "Creating…" : "Create invoice"}
          </Button>
        </div>
      </AdaptiveSheetContent>
    </AdaptiveSheet>
  );
}
