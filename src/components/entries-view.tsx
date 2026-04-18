"use client";

import { useState } from "react";
import type { Entry, Invoice } from "@/lib/types";
import { formatAUD, formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Plus } from "lucide-react";

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

function groupByClientWeek(entries: Entry[], invoiceMap: Map<string, Invoice>): ClientWeekGroup[] {
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
    const inv = invoiced && first.invoice_id ? invoiceMap.get(first.invoice_id) : undefined;
    groups.push({
      key,
      clientName: first.client.name,
      clientColor: first.client.color,
      isoWeek: first.iso_week,
      entries: groupEntries.sort((a, b) => b.date.localeCompare(a.date)),
      subtotal: groupEntries.reduce((sum, e) => sum + e.base_amount + e.bonus_amount, 0),
      invoiced,
      invoiceNumber: inv?.number,
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

function EntryRow({
  entry,
  showClient = false,
  invoiceMap,
}: {
  entry: Entry;
  showClient?: boolean;
  invoiceMap: Map<string, Invoice>;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 hover:bg-accent/50 transition-colors cursor-pointer">
      <span className="text-xs text-muted-foreground tabular-nums w-20 shrink-0">
        {formatDate(entry.date)}
      </span>
      {showClient && (
        <div className="flex items-center gap-2 w-32 shrink-0">
          <div
            className="size-2 rounded-full shrink-0"
            style={{ backgroundColor: entry.client.color }}
          />
          <span className="text-sm font-medium truncate">{entry.client.name}</span>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <span className="text-sm text-foreground truncate block">
          {entry.description}
        </span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {showClient && (() => {
          const inv = entry.invoice_id ? invoiceMap.get(entry.invoice_id) : undefined;
          return (
            <div className="w-20 flex justify-start">
              {inv ? (
                <Badge variant={INVOICE_STATUS_VARIANT[inv.status]}>{inv.number}</Badge>
              ) : (
                <Badge variant="outline">Draft</Badge>
              )}
            </div>
          );
        })()}
        <span className="text-xs text-muted-foreground w-16 text-right">
          {entry.billing_type === "day_rate" && (entry.day_type === "full" ? "Full day" : "Half day")}
          {entry.billing_type === "hourly" && entry.hours && `${entry.hours}h`}
        </span>
        <span className="text-sm tabular-nums text-foreground w-24 text-right">
          {formatAUD(entry.base_amount + entry.bonus_amount)}
        </span>
      </div>
    </div>
  );
}

function ClientWeekGroupHeader({ group }: { group: ClientWeekGroup }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-muted/40 rounded-t-lg">
      <div className="flex items-center gap-2.5">
        <div
          className="size-2.5 rounded-full shrink-0"
          style={{ backgroundColor: group.clientColor }}
        />
        <span className="text-sm font-medium text-foreground">{group.clientName}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm tabular-nums text-muted-foreground">
          {formatAUD(group.subtotal)}
        </span>
        {group.invoiced ? (
          <Badge variant="secondary">{group.invoiceNumber}</Badge>
        ) : (
          <Button variant="outline" size="sm" className="h-7 text-xs">
            Invoice
          </Button>
        )}
      </div>
    </div>
  );
}

function WeekGroupHeader({ group }: { group: WeekGroup }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-muted/40 rounded-t-lg">
      <span className="text-sm font-medium text-foreground">{group.dateRange}</span>
      <span className="text-sm tabular-nums text-muted-foreground">
        {formatAUD(group.subtotal)}
      </span>
    </div>
  );
}

function InvoiceView({ entries, invoiceMap }: { entries: Entry[]; invoiceMap: Map<string, Invoice> }) {
  const groups = groupByClientWeek(entries, invoiceMap);

  return (
    <div className="px-4 md:px-6 py-6 flex flex-col gap-4">
      {groups.map((group) => (
        <Card key={group.key} className="overflow-hidden py-0 gap-0">
          <ClientWeekGroupHeader group={group} />
          <Separator />
          <CardContent className="p-0">
            {group.entries.map((entry, i) => (
              <div key={entry.id}>
                {i > 0 && <Separator />}
                <EntryRow entry={entry} invoiceMap={invoiceMap} />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
      <div className="text-center py-2">
        <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
          Load earlier
        </Button>
      </div>
    </div>
  );
}

function WeekView({ entries, invoiceMap }: { entries: Entry[]; invoiceMap: Map<string, Invoice> }) {
  const groups = groupByWeek(entries);

  return (
    <div className="px-4 md:px-6 py-6 flex flex-col gap-4">
      {groups.map((group) => (
        <Card key={group.key} className="overflow-hidden py-0 gap-0">
          <WeekGroupHeader group={group} />
          <Separator />
          <CardContent className="p-0">
            {group.entries.map((entry, i) => (
              <div key={entry.id}>
                {i > 0 && <Separator />}
                <EntryRow entry={entry} showClient invoiceMap={invoiceMap} />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
      <div className="text-center py-2">
        <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
          Load earlier
        </Button>
      </div>
    </div>
  );
}

function ListView({ entries, invoiceMap }: { entries: Entry[]; invoiceMap: Map<string, Invoice> }) {
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="px-4 md:px-6 py-6">
      <Card className="overflow-hidden py-0 gap-0">
        <CardContent className="p-0">
          {sorted.map((entry, i) => (
            <div key={entry.id}>
              {i > 0 && <Separator />}
              <EntryRow entry={entry} showClient invoiceMap={invoiceMap} />
            </div>
          ))}
        </CardContent>
      </Card>
      <div className="text-center py-4">
        <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
          Load earlier
        </Button>
      </div>
    </div>
  );
}

export function EntriesView({ entries, invoices }: { entries: Entry[]; invoices: Invoice[] }) {
  const [viewMode, setViewMode] = useState<ViewMode>("invoice");
  const invoiceMap = new Map(invoices.map((inv) => [inv.id, inv]));

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
        >
          <ToggleGroupItem value="invoice">Invoice</ToggleGroupItem>
          <ToggleGroupItem value="week">Week</ToggleGroupItem>
          <ToggleGroupItem value="none">None</ToggleGroupItem>
        </ToggleGroup>
        <Button size="sm" className="hidden md:flex">
          <Plus className="size-4" />
          New entry
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto">
        {viewMode === "invoice" && <InvoiceView entries={entries} invoiceMap={invoiceMap} />}
        {viewMode === "week" && <WeekView entries={entries} invoiceMap={invoiceMap} />}
        {viewMode === "none" && <ListView entries={entries} invoiceMap={invoiceMap} />}
      </div>

      <div className="md:hidden fixed bottom-18 right-4 z-40">
        <Button size="icon" className="size-14 rounded-full shadow-lg">
          <Plus />
        </Button>
      </div>
    </div>
  );
}
