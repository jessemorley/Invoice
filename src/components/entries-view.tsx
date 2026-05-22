"use client";

import { useState, useTransition, useRef, useCallback, useEffect } from "react";
import {
  revalidateEntries,
  loadEarlierEntries,
} from "@/app/(app)/entries/actions";
import { invalidate } from "@/lib/invalidate";
import type { Entry, Client, WorkflowRate, InvoiceRef } from "@/lib/types";
import { formatAUD, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EntrySheet } from "@/components/entry-sheet";
import { Plus, RefreshCw } from "lucide-react";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";

type ViewMode = "invoice" | "week" | "none";
type DateRange = "15d" | "30d" | "90d" | "all";

function getDateCutoff(range: DateRange): string | null {
  if (range === "all") return null;
  const days = range === "15d" ? 15 : range === "30d" ? 30 : 90;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

const INVOICE_STATUS_COLOR: Record<string, string> = {
  draft: "#94a3b8",
  issued: "#f97316",
  paid: "#10b981",
};

function EntryInvoiceBadge({ invoice }: { invoice: InvoiceRef | null | undefined }) {
  const status = invoice?.status ?? "draft";
  const color = INVOICE_STATUS_COLOR[status];
  return (
    <span
      className="inline-flex items-center rounded-full border border-transparent px-2 py-0.5 text-xs font-medium"
      style={{ color, backgroundColor: `${color}22` }}
    >
      {invoice?.number ?? "Draft"}
    </span>
  );
}

type ClientWeekGroup = {
  key: string;
  clientName: string;
  clientColor: string;
  entries: Entry[];
  subtotal: number;
  invoiced: boolean;
  invoiceNumber?: string;
  invoiceStatus?: string;
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
      entries: groupEntries.sort((a, b) => b.date.localeCompare(a.date)),
      subtotal: groupEntries.reduce(
        (sum, e) => sum + e.base_amount + e.bonus_amount,
        0,
      ),
      invoiced,
      invoiceNumber: invoiced ? first.invoice?.number : undefined,
      invoiceStatus: invoiced ? first.invoice?.status : undefined,
    });
  }

  return groups.sort((a, b) =>
    b.entries[0].date.localeCompare(a.entries[0].date),
  );
}


function financialYearWeekLabel(isoWeek: string): string {
  const [year, week] = isoWeek.split("-W").map(Number);
  const jan4 = new Date(year, 0, 4);
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - ((jan4.getDay() || 7) - 1) + (week - 1) * 7);
  const fyStartYear = monday.getMonth() >= 6 ? monday.getFullYear() : monday.getFullYear() - 1;
  const fyJul1 = new Date(fyStartYear, 6, 1);
  const fyWeek1Monday = new Date(fyJul1);
  fyWeek1Monday.setDate(fyJul1.getDate() - ((fyJul1.getDay() + 6) % 7));
  const weekNum = Math.round((monday.getTime() - fyWeek1Monday.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
  return `Week ${weekNum}`;
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
      dateRange: financialYearWeekLabel(key),
      latestDate: sorted[0].date,
      entries: sorted,
      subtotal: groupEntries.reduce(
        (sum, e) => sum + e.base_amount + e.bonus_amount,
        0,
      ),
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

function SkeletonGroupHeader() {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 min-h-[40px]">
      <Skeleton className="h-3 w-28" />
      <div className="flex-1" />
      <Skeleton className="h-3 w-16" />
    </div>
  );
}

function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col">
      <SkeletonGroupHeader />
      <Card className="overflow-hidden py-0 gap-0">
        <CardContent className="p-0">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i}>
              {i > 0 && <Separator />}
              <SkeletonRow />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
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
  const description = entry.shoot_client || entry.description || entry.workflow_type;
  const total = entry.base_amount + entry.bonus_amount;

  return (
    <div
      className="hover:bg-accent/50 transition-colors cursor-pointer"
      onClick={() => onEdit(entry)}
    >
      {/* Mobile */}
      <div className="md:hidden flex items-center gap-3 px-4 py-3">
        <div className="flex-1 min-w-0">
          {showClient ? (
            <>
              <div className="flex items-center gap-1.5">
                <div
                  className="size-2 rounded-full shrink-0"
                  style={{ backgroundColor: entry.client.color }}
                />
                <span className="text-sm font-medium text-foreground truncate">
                  {entry.client.name}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                  {formatDate(entry.date)}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">·</span>
                <span className="text-xs text-muted-foreground truncate">
                  {description}
                </span>
              </div>
            </>
          ) : (
            <>
              <span className="text-sm font-medium text-foreground truncate block">
                {description}
              </span>
              <span className="text-xs text-muted-foreground tabular-nums mt-0.5 block">
                {formatDate(entry.date)}
              </span>
            </>
          )}
        </div>
        <div className="flex flex-col items-end gap-0.5 shrink-0">
          <span className="text-sm tabular-nums text-foreground">
            {formatAUD(total)}
          </span>
          <span className="text-xs tabular-nums text-muted-foreground">
            {entry.billing_type === "day_rate" &&
              (entry.day_type === "full" ? "Full day" : "Half day")}
            {entry.billing_type === "hourly" && entry.hours && `${entry.hours}h`}
          </span>
        </div>
      </div>

      {/* Desktop */}
      <div className="hidden md:flex items-center gap-3 px-4 py-3.5">
        <span className="text-xs text-muted-foreground tabular-nums w-20 shrink-0">
          {formatDate(entry.date)}
        </span>
        {showClient && (
          <div className="flex items-center gap-2 w-40 shrink-0">
            <div
              className="size-2 rounded-full shrink-0"
              style={{ backgroundColor: entry.client.color }}
            />
            <span className="text-sm font-medium truncate">
              {entry.client.name}
            </span>
          </div>
        )}
        <div className="flex flex-1 min-w-0 items-center gap-2">
          <span className="text-sm text-foreground truncate">
            {description}
          </span>
          {entry.brand && (
            <span className="text-sm text-muted-foreground shrink-0">
              ({entry.brand})
            </span>
          )}
          {entry.role && (
            <span className="text-sm text-muted-foreground shrink-0">
              (
              {entry.role === "Photographer"
                ? "P"
                : entry.role === "Operator" || entry.role === "O"
                  ? "O"
                  : entry.role}
              )
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground w-20 shrink-0">
          {entry.billing_type === "day_rate" &&
            (entry.day_type === "full" ? "Full day" : "Half day")}
          {entry.billing_type === "hourly" && entry.hours && `${entry.hours}h`}
        </span>
        <div className="flex items-center gap-3 shrink-0 ml-auto">
          {showClient && (
            <div className="flex w-20 justify-start">
              <EntryInvoiceBadge invoice={entry.invoice} />
            </div>
          )}
          <span className="text-sm tabular-nums text-foreground text-right w-20 shrink-0">
            {formatAUD(total)}
          </span>
        </div>
      </div>
    </div>
  );
}

function ClientWeekGroupHeader({ group }: { group: ClientWeekGroup }) {
  const status = group.invoiceStatus ?? "draft";
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <span
        className="inline-flex items-center rounded-full border border-transparent px-2 py-0.5 text-xs font-medium shrink-0"
        style={{
          color: INVOICE_STATUS_COLOR[status],
          backgroundColor: `${INVOICE_STATUS_COLOR[status]}22`,
        }}
      >
        {group.invoiceNumber ?? "Draft"}
      </span>
      <span className="text-sm font-medium text-muted-foreground">
        {group.clientName}
      </span>
      <div className="flex-1" />
      <span className="text-xs tabular-nums font-medium text-muted-foreground text-right w-20 shrink-0">
        {formatAUD(group.subtotal)}
      </span>
    </div>
  );
}

function WeekGroupHeader({ group }: { group: WeekGroup }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <span className="text-sm font-medium text-muted-foreground">
        {group.dateRange}
      </span>
      <div className="flex-1" />
      <span className="text-xs tabular-nums font-medium text-muted-foreground text-right shrink-0">
        {formatAUD(group.subtotal)}
      </span>
    </div>
  );
}

const PAGE_SIZE = 10;

function LoadEarlierButton({
  onLoad,
  isPending,
}: {
  onLoad: () => void;
  isPending: boolean;
}) {
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
  displayCount,
  onLoadEarlier,
  isPending,
  onEdit,
}: {
  entries: Entry[];
  displayCount: number;
  onLoadEarlier: () => void;
  isPending: boolean;
  onEdit: (entry: Entry) => void;
}) {
  const groups = groupByClientWeek(entries);
  const visible = groups.slice(0, displayCount);
  const hasMore = displayCount < groups.length;

  return (
    <div className="px-4 md:px-6 pb-6 mx-auto w-full max-w-6xl flex flex-col gap-4">
      {visible.map((group) => (
        <div key={group.key} className="flex flex-col">
          <ClientWeekGroupHeader group={group} />
          <Card className="overflow-hidden py-0 gap-0">
            <CardContent className="p-0">
              {group.entries.map((entry, i) => (
                <div key={entry.id}>
                  {i > 0 && <Separator />}
                  <EntryRow entry={entry} onEdit={onEdit} />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      ))}
      {hasMore && (
        <LoadEarlierButton onLoad={onLoadEarlier} isPending={isPending} />
      )}
    </div>
  );
}

function WeekView({
  entries,
  displayCount,
  onLoadEarlier,
  isPending,
  onEdit,
}: {
  entries: Entry[];
  displayCount: number;
  onLoadEarlier: () => void;
  isPending: boolean;
  onEdit: (entry: Entry) => void;
}) {
  const groups = groupByWeek(entries);
  const visible = groups.slice(0, displayCount);
  const hasMore = displayCount < groups.length;

  return (
    <div className="px-4 md:px-6 pb-6 mx-auto w-full max-w-6xl flex flex-col gap-4">
      {visible.map((group) => (
        <div key={group.key} className="flex flex-col">
          <WeekGroupHeader group={group} />
          <Card className="overflow-hidden py-0 gap-0">
            <CardContent className="p-0">
              {group.entries.map((entry, i) => (
                <div key={entry.id}>
                  {i > 0 && <Separator />}
                  <EntryRow entry={entry} showClient onEdit={onEdit} />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      ))}
      {hasMore && (
        <LoadEarlierButton onLoad={onLoadEarlier} isPending={isPending} />
      )}
    </div>
  );
}

function ListView({
  entries,
  displayCount,
  onLoadEarlier,
  isPending,
  onEdit,
}: {
  entries: Entry[];
  displayCount: number;
  onLoadEarlier: () => void;
  isPending: boolean;
  onEdit: (entry: Entry) => void;
}) {
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  const visible = sorted.slice(0, displayCount * 5);
  const hasMore = visible.length < sorted.length;

  return (
    <div className="px-4 md:px-6 pb-6 mx-auto w-full max-w-6xl">
      <Card className="overflow-hidden py-0 gap-0">
        <CardContent className="p-0">
          {visible.map((entry, i) => (
            <div key={entry.id}>
              {i > 0 && <Separator />}
              <EntryRow entry={entry} showClient onEdit={onEdit} />
            </div>
          ))}
        </CardContent>
      </Card>
      {hasMore && (
        <LoadEarlierButton onLoad={onLoadEarlier} isPending={isPending} />
      )}
    </div>
  );
}

export function EntriesView({
  entries: initialEntries,
  clients,
  workflowRates,
  loading = false,
}: {
  entries?: Entry[];
  clients: Client[];
  workflowRates: WorkflowRate[];
  loading?: boolean;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [dateRange, setDateRange] = useState<DateRange>("15d");
  const [sheetOpen, setSheetOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const handlePullRefresh = useCallback(async () => {
    await revalidateEntries();
    invalidate("entries");
  }, []);
  const { pullDistance, state: pullState } = usePullToRefresh({
    ref: scrollRef,
    onRefresh: handlePullRefresh,
    enabled: !loading,
  });
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
  const [additionalEntries, setAdditionalEntries] = useState<Entry[]>([]);
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const [isPending, startTransition] = useTransition();

  const entries = [...(initialEntries ?? []), ...additionalEntries];
  const cutoff = getDateCutoff(dateRange);
  const filteredEntries = cutoff ? entries.filter((e) => e.date >= cutoff) : entries;

  const [prevViewMode, setPrevViewMode] = useState(viewMode);
  if (prevViewMode !== viewMode) {
    setPrevViewMode(viewMode);
    setDisplayCount(PAGE_SIZE);
  }

  function openEdit(entry: Entry) {
    setSelectedEntry(entry);
    setSheetOpen(true);
  }

  const openNew = useCallback(() => {
    setSelectedEntry(null);
    setSheetOpen(true);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent<string>).detail === "entries") openNew();
    };
    window.addEventListener("dock:new", handler);
    return () => window.removeEventListener("dock:new", handler);
  }, [openNew]);

  function handleLoadEarlier() {
    const oldest = entries.reduce(
      (min, e) => (e.date < min ? e.date : min),
      entries[0]?.date ?? new Date().toISOString().slice(0, 10),
    );
    startTransition(async () => {
      const earlier = await loadEarlierEntries(oldest);
      const existingIds = new Set(entries.map((e) => e.id));
      setAdditionalEntries((prev) => [
        ...prev,
        ...earlier.filter((e) => !existingIds.has(e.id)),
      ]);
    });
  }

  return (
    <div className="flex flex-col h-full">
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto pb-28 md:pb-0"
        onScroll={(e) => {
          const el = e.currentTarget;
          if (el.scrollHeight - el.scrollTop - el.clientHeight < 400) {
            setDisplayCount((prev) => prev + PAGE_SIZE);
          }
        }}
      >
        {/* Pull-to-refresh indicator — sits at top of scroll content, hidden until pulled */}
        <div
          className="md:hidden flex items-center justify-center overflow-hidden pointer-events-none"
          style={{ height: pullState !== "idle" ? pullDistance : 0 }}
        >
          <RefreshCw
            className={`size-5 text-muted-foreground ${pullState === "refreshing" ? "animate-spin" : ""}`}
            style={{
              transform:
                pullState !== "refreshing"
                  ? `rotate(${(pullDistance / 70) * 180}deg)`
                  : undefined,
            }}
          />
        </div>

        {/* Inline page header */}
        <div className="px-4 md:px-6 pt-8 pb-6 mx-auto w-full max-w-6xl flex flex-col md:flex-row md:items-center gap-3">
          <h1 className="text-2xl font-bold md:mr-auto">Entries</h1>
          <div className="flex gap-2">
            <Select
              value={viewMode}
              onValueChange={(v) => setViewMode(v as ViewMode)}
              disabled={loading}
            >
              <SelectTrigger size="sm" className="flex-1 md:flex-none md:w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Week</SelectItem>
                <SelectItem value="invoice">Invoice</SelectItem>
                <SelectItem value="none">None</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={dateRange}
              onValueChange={(v) => setDateRange(v as DateRange)}
              disabled={loading}
            >
              <SelectTrigger size="sm" className="flex-1 md:flex-none md:w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15d">Last 15 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            size="sm"
            className="hidden md:flex"
            onClick={openNew}
            disabled={loading}
          >
            <Plus className="size-4" />
            Add entry
          </Button>
        </div>

        {loading ? (
          <ContentSkeleton />
        ) : (
          <>
            {viewMode === "invoice" && (
              <InvoiceView
                entries={filteredEntries}
                displayCount={displayCount}
                onEdit={openEdit}
                onLoadEarlier={handleLoadEarlier}
                isPending={isPending}
              />
            )}
            {viewMode === "week" && (
              <WeekView
                entries={filteredEntries}
                displayCount={displayCount}
                onEdit={openEdit}
                onLoadEarlier={handleLoadEarlier}
                isPending={isPending}
              />
            )}
            {viewMode === "none" && (
              <ListView
                entries={filteredEntries}
                displayCount={displayCount}
                onEdit={openEdit}
                onLoadEarlier={handleLoadEarlier}
                isPending={isPending}
              />
            )}
          </>
        )}
      </div>

      <EntrySheet
        open={sheetOpen}
        onOpenChangeAction={setSheetOpen}
        entry={selectedEntry}
        clients={clients}
        workflowRates={workflowRates}
      />
    </div>
  );
}
