"use client";

import { useState, useTransition, useEffect } from "react";
import { loadUninvoicedGroups, generateInvoices } from "@/app/(app)/invoices/actions";
import type { UninvoicedGroup } from "@/lib/queries";
import { formatAUD } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export function GenerateSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [groups, setGroups] = useState<UninvoicedGroup[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setIsLoading(true);
    loadUninvoicedGroups().then((g) => {
      setGroups(g);
      setSelected(new Set(g.map((group) => group.key)));
      setIsLoading(false);
    }).catch((e) => {
      setError(e instanceof Error ? e.message : "Failed to load groups");
      setIsLoading(false);
    });
  }, [open]);

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleGenerate() {
    setError(null);
    startTransition(async () => {
      try {
        await generateInvoices(Array.from(selected));
        onOpenChange(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  const selectedCount = selected.size;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col gap-0 p-0 w-full sm:max-w-md">
        <SheetHeader className="px-4 py-4 border-b">
          <SheetTitle className="text-base">Generate invoices</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex flex-col gap-0">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-4 border-b">
                  <Skeleton className="size-4 rounded" />
                  <Skeleton className="size-2.5 rounded-full" />
                  <div className="flex flex-col gap-1.5 flex-1">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-3 w-16" />
                </div>
              ))}
            </div>
          ) : groups.length === 0 ? (
            <p className="px-4 py-8 text-sm text-muted-foreground text-center">
              No uninvoiced entries found.
            </p>
          ) : (
            <div className="flex flex-col">
              {groups.map((group) => (
                <button
                  key={group.key}
                  className="flex items-center gap-3 px-4 py-4 border-b hover:bg-accent/50 transition-colors text-left w-full"
                  onClick={() => toggle(group.key)}
                >
                  <Checkbox
                    checked={selected.has(group.key)}
                    onCheckedChange={() => toggle(group.key)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div
                    className="size-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: group.clientColor }}
                  />
                  <div className="flex flex-col min-w-0 flex-1 gap-0.5">
                    <span className="text-sm font-medium">{group.clientName}</span>
                    <span className="text-xs text-muted-foreground">
                      {group.dateRange} · {group.entryCount} {group.entryCount === 1 ? "entry" : "entries"}
                    </span>
                  </div>
                  <span className="text-sm tabular-nums text-foreground shrink-0">
                    {formatAUD(group.subtotal)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="border-t px-4 py-3 flex flex-col gap-2">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            className="w-full"
            onClick={handleGenerate}
            disabled={isPending || isLoading || selectedCount === 0}
          >
            {isPending
              ? "Generating…"
              : `Generate ${selectedCount} ${selectedCount === 1 ? "invoice" : "invoices"}`}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
