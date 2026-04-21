"use client";

import { useState, useTransition } from "react";
import { loadEarlierEntries } from "@/app/(app)/entries/actions";
import type { Entry } from "@/lib/types";
import { formatAUD, formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { EntrySheet } from "@/components/entry-sheet";
import { Plus } from "lucide-react";

type Client = { id: string; name: string; billing_type: string; color: string | null };

type ViewMode = "invoice" | "week" | "none";

const INVOICE_STATUS_VARIANT: Record<string, "outline" | "secondary" | "default"> = {
  draft:  "outline",
  issued: "secondary",
  paid:   "default",
};

type ClientWeekGroup = {
  key: string;
  clientName: string;
  clientColor: string;
  isoWeek: string;
  dateRange: string;
  entries: Entry[];
  subtotal: number;
  invoiced: boolean;
  invoiceNumber?: string;
};

type WeekGroup = {
  key: string;
  dateRange: string;
  latestDate: string;
  entries: Entry[];
  subtotal: number;
};

function groupByClientWeek(entries: Entry[]): ClientWeekGroup[] {
  const map = new Map<string, Entry[]>();
  for (const entry of entries) {
    const key = `${entry.client.id}-${entry.iso_week}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(entry);
  }

  const groups: ClientWeekGroup[] = [];
  for (const [key, groupEntries] of map) {
    const first = groupEntries[0];
    const invoiced = groupEntries.every((e) => !!e.invoice_id);
    groups.push({
      key,
      clientName: first.client.name,
      clientColor: first.client.color,
      isoWeek: first.iso_week,
      dateRange: weekDateRange(groupEntries.map((e) => e.date)),
      entries: groupEntries.sort((a, b) => b.date.localeCompare(a.date)),
      subtotal: groupEntries.reduce((sum, e) => sum + e.base_amount + e.bonus_amount, 0),
      invoiced,
      invoiceNumber: invoiced ? first.invoice?.number : undefined,
    });
  }

  return groups.sort((a, b) => b.entries[0].date.localeCompare(a.entries[0].date));
}

function weekDateRange(dates: string[]): string {
  const sorted = [...dates].sort();
  const first = new Date(sorted[0] + "T00:00:00");
  const last = new Date(sorted[sorted.length - 1] + "T00:00:00");
  const firstDay = first.getDate();
  const lastDay = last.getDate();
  const firstMonth = first.toLocaleDateString("en-AU", { month: "short" });
  const lastMonth = last.toLocaleDateString("en-AU", { month: "short" });
  if (sorted[0] === sorted[sorted.length - 1]) return `${firstDay} ${firstMonth}`;
  if (first.getMonth() === last.getMonth()) return `${firstDay}–${lastDay} ${firstMonth}`;
  return `${firstDay} ${firstMonth} – ${lastDay} ${lastMonth}`;
}

function groupByWeek(entries: Entry[]): WeekGroup[] {
  const map = new Map<string, Entry[]>();
  for (const entry of entries) {
    const key = entry.iso_week;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(entry);
  }

  const groups: WeekGroup[] = [];
  for (const [key, groupEntries] of map) {
    const sorted = groupEntries.sort((a, b) => b.date.localeCompare(a.date));
    groups.push({
      key,
      dateRange: weekDateRange(groupEntries.map((e) => e.date)),
      latestDate: sorted[0].date,
      entries: sorted,
      subtotal: groupEntries.reduce((sum, e) => sum + e.base_amount + e.bonus_amount, 0),
    });
  }

  return groups.sort((a, b) => b.latestDate.localeCompare(a.latestDate));
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <Skeleton className="h-3 w-20 shrink-0" />
      <Skeleton className="h-3 flex-1" />
      <Skeleton className="h-3 w-16 shrink-0" />
      <Skeleton className="h-3 w-20 shrink-0" />
    </div>
  );
}

function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <Card className="overflow-hidden py-0 gap-0">
      <div className="flex items-center gap-2.5 px-4 py-2.5 border-b">
        <Skeleton className="size-2.5 rounded-full shrink-0" />
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-3 w-14" />
        <div className="flex-1" />
        <Skeleton className="h-6 w-16 rounded-md" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-24" />
      </div>
      <CardContent className="p-0">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i}>
            {i > 0 && <Separator />}
            <SkeletonRow />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ContentSkeleton() {
  return (
    <div className="px-4 md:px-6 py-6 mx-auto w-full max-w-6xl flex flex-col gap-4">
      <SkeletonCard rows={2} />
      <SkeletonCard rows={3} />
      <SkeletonCard rows={1} />
      <SkeletonCard rows={4} />
      <SkeletonCard rows={2} />
    </div>
  );
}

function EntryRow({
  entry,
  showClient = false,
  onEdit,
}: {
  entry: Entry;
  showClient?: boolean;
  onEdit: (entry: Entry) => void;
}) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3.5 hover:bg-accent/50 transition-colors cursor-pointer"
      onClick={() => onEdit(entry)}
    >
      <span className="text-xs text-muted-foreground tabular-nums w-20 shrink-0">
        {formatDate(entry.date)}
      </span>
      {showClient && (
        <div className="flex items-center gap-2 w-40 shrink-0">
          <div
            className="size-2 rounded-full shrink-0"
            style={{ backgroundColor: entry.client.color }}
          />
          <span className="text-sm font-medium truncate">{entry.client.name}</span>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <span className="text-sm text-foreground truncate block">
          {entry.description ?? entry.workflow_type}
        </span>
      </div>
      <span className="text-xs text-muted-foreground w-20 shrink-0">
        {entry.billing_type === "day_rate" && (entry.day_type === "full" ? "Full day" : "Half day")}
        {entry.billing_type === "hourly" && entry.hours && `${entry.hours}h`}
      </span>
      <div className="flex items-center gap-3 shrink-0">
        {showClient && (
          <div className="w-20 flex justify-start">
            {entry.invoice ? (
              <Badge variant={INVOICE_STATUS_VARIANT[entry.invoice.status]}>{entry.invoice.number}</Badge>
            ) : (
              <Badge variant="outline">Draft</Badge>
            )}
          </div>
        )}
        <span className="text-sm tabular-nums text-foreground w-24 text-right">
          {formatAUD(entry.base_amount + entry.bonus_amount)}
        </span>
      </div>
    </div>
  );
}

function ClientWeekGroupHeader({ group }: { group: ClientWeekGroup }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b">
      <div
        className="size-2.5 rounded-full shrink-0"
        style={{ backgroundColor: group.clientColor }}
      />
      <span className="text-sm font-semibold text-foreground">{group.clientName}</span>
      {group.invoiced ? (
        <Badge variant="secondary">{group.invoiceNumber}</Badge>
      ) : (
        <Button variant="outline" size="sm" className="h-6 px-2 text-xs">
          <Plus className="size-3" />
          Invoice
        </Button>
      )}
      <div className="flex-1" />
      <span className="text-xs tabular-nums font-semibold text-foreground w-24 text-right">
        {formatAUD(group.subtotal)}
      </span>
    </div>
  );
}

function WeekGroupHeader({ group }: { group: WeekGroup }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b">
      <span className="text-sm font-semibold text-foreground">{group.dateRange}</span>
      <div className="flex-1" />
      <span className="text-xs tabular-nums font-semibold text-foreground w-24 text-right">
        {formatAUD(group.subtotal)}
      </span>
    </div>
  );
}

function LoadEarlierButton({ onLoad, isPending }: { onLoad: () => void; isPending: boolean }) {
  if (isPending) {
    return (
      <>
        <SkeletonCard rows={2} />
        <SkeletonCard rows={3} />
      </>
    );
  }
  return (
    <div className="text-center py-2">
      <Button
        variant="ghost"
        size="sm"
        className="text-xs text-muted-foreground"
        onClick={onLoad}
      >
        Load earlier
      </Button>
    </div>
  );
}

function InvoiceView({
  entries,
  onEdit,
  onLoadEarlier,
  isPending,
}: {
  entries: Entry[];
  onEdit: (entry: Entry) => void;
  onLoadEarlier: () => void;
  isPending: boolean;
}) {
  const groups = groupByClientWeek(entries);

  return (
    <div className="px-4 md:px-6 py-6 mx-auto w-full max-w-6xl flex flex-col gap-6">
      {groups.map((group) => (
        <Card key={group.key} className="overflow-hidden py-0 gap-0">
          <ClientWeekGroupHeader group={group} />
          <CardContent className="p-0">
            {group.entries.map((entry, i) => (
              <div key={entry.id}>
                {i > 0 && <Separator />}
                <EntryRow entry={entry} onEdit={onEdit} />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
      <LoadEarlierButton onLoad={onLoadEarlier} isPending={isPending} />
    </div>
  );
}

function WeekView({
  entries,
  onEdit,
  onLoadEarlier,
  isPending,
}: {
  entries: Entry[];
  onEdit: (entry: Entry) => void;
  onLoadEarlier: () => void;
  isPending: boolean;
}) {
  const groups = groupByWeek(entries);

  return (
    <div className="px-4 md:px-6 py-6 mx-auto w-full max-w-6xl flex flex-col gap-6">
      {groups.map((group) => (
        <Card key={group.key} className="overflow-hidden py-0 gap-0">
          <WeekGroupHeader group={group} />
          <CardContent className="p-0">
            {group.entries.map((entry, i) => (
              <div key={entry.id}>
                {i > 0 && <Separator />}
                <EntryRow entry={entry} showClient onEdit={onEdit} />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
      <LoadEarlierButton onLoad={onLoadEarlier} isPending={isPending} />
    </div>
  );
}

function ListView({
  entries,
  onEdit,
  onLoadEarlier,
  isPending,
}: {
  entries: Entry[];
  onEdit: (entry: Entry) => void;
  onLoadEarlier: () => void;
  isPending: boolean;
}) {
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="px-4 md:px-6 py-6 mx-auto w-full max-w-6xl">
      <Card className="overflow-hidden py-0 gap-0">
        <CardContent className="p-0">
          {sorted.map((entry, i) => (
            <div key={entry.id}>
              {i > 0 && <Separator />}
              <EntryRow entry={entry} showClient onEdit={onEdit} />
            </div>
          ))}
        </CardContent>
      </Card>
      <LoadEarlierButton onLoad={onLoadEarlier} isPending={isPending} />
    </div>
  );
}

export function EntriesView({
  entries: initialEntries,
  clients,
  loading = false,
}: {
  entries?: Entry[];
  clients: Client[];
  loading?: boolean;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>("invoice");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
  const [entries, setEntries] = useState<Entry[]>(initialEntries ?? []);
  const [isPending, startTransition] = useTransition();

  function openEdit(entry: Entry) {
    setSelectedEntry(entry);
    setSheetOpen(true);
  }

  function openNew() {
    setSelectedEntry(null);
    setSheetOpen(true);
  }

  function handleLoadEarlier() {
    const oldest = entries.reduce((min, e) => e.date < min ? e.date : min, entries[0]?.date ?? new Date().toISOString().slice(0, 10));
    startTransition(async () => {
      const earlier = await loadEarlierEntries(oldest);
      const existingIds = new Set(entries.map((e) => e.id));
      setEntries((prev) => [...prev, ...earlier.filter((e) => !existingIds.has(e.id))]);
    });
  }

  return (
    <div className="flex flex-col h-full">
      <header className="flex h-14 items-center gap-2 border-b px-4">
        <SidebarTrigger />
        <h1 className="text-lg font-semibold">Entries</h1>
        <div className="flex-1" />
        <ToggleGroup
          type="single"
          value={viewMode}
          onValueChange={(value) => value && setViewMode(value as ViewMode)}
          variant="outline"
          size="sm"
          disabled={loading}
        >
          <ToggleGroupItem value="invoice">Invoice</ToggleGroupItem>
          <ToggleGroupItem value="week">Week</ToggleGroupItem>
          <ToggleGroupItem value="none">None</ToggleGroupItem>
        </ToggleGroup>
        <Button size="sm" className="hidden md:flex" onClick={openNew} disabled={loading}>
          <Plus className="size-4" />
          New entry
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <ContentSkeleton />
        ) : (
          <>
            {viewMode === "invoice" && <InvoiceView entries={entries} onEdit={openEdit} onLoadEarlier={handleLoadEarlier} isPending={isPending} />}
            {viewMode === "week" && <WeekView entries={entries} onEdit={openEdit} onLoadEarlier={handleLoadEarlier} isPending={isPending} />}
            {viewMode === "none" && <ListView entries={entries} onEdit={openEdit} onLoadEarlier={handleLoadEarlier} isPending={isPending} />}
          </>
        )}
      </div>

      <div className="md:hidden fixed bottom-18 right-4 z-40">
        <Button size="icon" className="size-14 rounded-full shadow-lg" onClick={openNew} disabled={loading}>
          <Plus />
        </Button>
      </div>

      <EntrySheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        entry={selectedEntry}
        clients={clients}
      />
    </div>
  );
}
