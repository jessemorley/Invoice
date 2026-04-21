"use client";

import { useCallback, useState, useTransition, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { loadMoreInvoices } from "./actions";
import type { Invoice, InvoiceStatus } from "@/lib/types";
import type { InvoiceFilters } from "@/lib/queries";
import { formatAUD, formatDateShort } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SortableTableHead } from "@/components/sortable-table-head";
import { PageHeader } from "@/components/page-header";
import { InvoiceSheet } from "@/components/invoice-sheet";
import { ChevronDown, FileText, Plus, Search } from "lucide-react";

type SortKey = NonNullable<InvoiceFilters["sortKey"]>;

const TIMEFRAME_OPTIONS = [
  { value: "all", label: "All time" },
  { value: "this-week", label: "This week" },
  { value: "this-month", label: "This month" },
  { value: "last-month", label: "Last month" },
  { value: "this-year", label: "This year" },
] as const;

function timeframeToDateRange(value: string): { from?: string; to?: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  if (value === "all") return { from: "all" };

  switch (value) {
    case "this-week": {
      const day = now.getDay() || 7;
      const mon = new Date(now); mon.setDate(now.getDate() - day + 1);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      return { from: fmt(mon), to: fmt(sun) };
    }
    case "this-month":
      return { from: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), to: fmt(now) };
    case "last-month": {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: fmt(first), to: fmt(last) };
    }
    case "this-year":
      return { from: `${now.getFullYear()}-01-01`, to: fmt(now) };
    default:
      return {};
  }
}

const STATUS_VARIANT: Record<InvoiceStatus, "outline" | "secondary" | "default"> = {
  draft:  "outline",
  issued: "secondary",
  paid:   "default",
};

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft:  "Draft",
  issued: "Issued",
  paid:   "Paid",
};

function StatusBadge({
  status,
  onStatusChange,
}: {
  status: InvoiceStatus;
  onStatusChange: (s: InvoiceStatus) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="focus:outline-none" onClick={(e) => e.stopPropagation()}>
          <Badge
            variant={STATUS_VARIANT[status]}
            className="cursor-pointer gap-0.5 pr-1"
          >
            {STATUS_LABEL[status]}
            <ChevronDown className="size-3 opacity-60" />
          </Badge>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        {(Object.keys(STATUS_LABEL) as InvoiceStatus[]).map((s) => (
          <DropdownMenuItem key={s} onSelect={() => onStatusChange(s)}>
            {STATUS_LABEL[s]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function InvoiceCard({ invoice }: { invoice: Invoice }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors cursor-pointer">
      <div
        className="size-2.5 rounded-full shrink-0"
        style={{ backgroundColor: invoice.client.color }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">
            {invoice.number}
          </span>
          <span className="text-sm text-muted-foreground truncate">
            {invoice.client.name}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-muted-foreground">
            {invoice.date_range}
          </span>
          <span className="text-xs text-muted-foreground">
            {invoice.entry_count} entries
          </span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="text-sm tabular-nums text-foreground">
          {formatAUD(invoice.total)}
        </span>
        <Badge variant={STATUS_VARIANT[invoice.status]}>
          {STATUS_LABEL[invoice.status]}
        </Badge>
      </div>
    </div>
  );
}

function SkeletonTableRows({ count = 8 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <TableRow key={i}>
          <TableCell className="py-4 px-6"><Skeleton className="h-3 w-24" /></TableCell>
          <TableCell className="py-4 px-6"><Skeleton className="h-3 w-16" /></TableCell>
          <TableCell className="py-4 px-6">
            <div className="flex items-center gap-2">
              <Skeleton className="size-2 rounded-full shrink-0" />
              <Skeleton className="h-3 w-28" />
            </div>
          </TableCell>
          <TableCell className="py-4 px-6 text-right"><Skeleton className="h-3 w-6 ml-auto" /></TableCell>
          <TableCell className="py-4 px-6"><Skeleton className="h-3 w-20" /></TableCell>
          <TableCell className="py-4 px-6 text-right"><Skeleton className="h-3 w-16 ml-auto" /></TableCell>
          <TableCell className="py-4 px-6 text-right"><Skeleton className="h-5 w-14 ml-auto rounded-full" /></TableCell>
        </TableRow>
      ))}
    </>
  );
}

function SkeletonMobileCards({ count = 6 }: { count?: number }) {
  return (
    <div className="px-4 py-4 flex flex-col gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="py-0">
          <CardContent className="p-0">
            <div className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="size-2.5 rounded-full shrink-0" />
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-3 w-32" />
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-5 w-12 rounded-full" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

type Props = {
  invoices?: Invoice[];
  uninvoicedCount?: number;
  clients?: { id: string; name: string }[];
  filters: InvoiceFilters;
  loading?: boolean;
};

const EMPTY_INVOICES: Invoice[] = [];
const EMPTY_CLIENTS: { id: string; name: string }[] = [];

export function InvoicesClient({ invoices: initialInvoices = EMPTY_INVOICES, uninvoicedCount = 0, clients = EMPTY_CLIENTS, filters, loading = false }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const [loadPending, startLoadTransition] = useTransition();

  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const [localStatuses, setLocalStatuses] = useState<Record<string, InvoiceStatus>>(
    () => Object.fromEntries(initialInvoices.map((inv) => [inv.id, inv.status]))
  );
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [searchValue, setSearchValue] = useState(filters.search ?? "");

  // Reset invoice list when server-side filters change (URL navigation)
  useEffect(() => {
    setInvoices(initialInvoices);
    setLocalStatuses(Object.fromEntries(initialInvoices.map((inv) => [inv.id, inv.status])));
  }, [initialInvoices]);

  function handleLoadMore() {
    const oldest = invoices.reduce(
      (min, inv) => inv.issued_date < min ? inv.issued_date : min,
      invoices[0]?.issued_date ?? new Date().toISOString().slice(0, 10)
    );
    startLoadTransition(async () => {
      const more = await loadMoreInvoices(oldest, filters);
      const existingIds = new Set(invoices.map((inv) => inv.id));
      const fresh = more.filter((inv) => !existingIds.has(inv.id));
      setInvoices((prev) => [...prev, ...fresh]);
      setLocalStatuses((prev) => ({
        ...prev,
        ...Object.fromEntries(fresh.map((inv) => [inv.id, inv.status])),
      }));
    });
  }

  function openInvoice(inv: Invoice) {
    setSelectedInvoice(inv);
    setSheetOpen(true);
  }

  const pushParams = useCallback((updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const current: Record<string, string | undefined> = {
      search: filters.search,
      status: filters.status,
      client: filters.clientId,
      sort: filters.sortKey,
      dir: filters.sortDir,
    };
    const merged = { ...current, ...updates };
    for (const [k, v] of Object.entries(merged)) {
      if (v && v !== "all" && v !== "issued_date" && !(k === "dir" && v === "desc")) {
        params.set(k, v);
      }
    }
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }, [filters, pathname, router]);

  function handleSort(key: SortKey) {
    const newDir = filters.sortKey === key && filters.sortDir === "asc" ? "desc" : "asc";
    pushParams({ sort: key, dir: newDir });
  }

  function handleSearchCommit(value: string) {
    pushParams({ search: value || undefined });
  }

  function handleStatusChange(id: string, status: InvoiceStatus) {
    setLocalStatuses((prev) => ({ ...prev, [id]: status }));
  }

  function sh(key: SortKey) {
    return {
      active: filters.sortKey === key,
      dir: (filters.sortDir ?? "desc") as "asc" | "desc",
      onSort: () => handleSort(key),
    };
  }

  const currentTimeframe = (() => {
    if (!filters.from || filters.from === "all") return "all";
    const { from, to } = timeframeToDateRange("this-week");
    if (filters.from === from && filters.to === to) return "this-week";
    const { from: fm, to: tm } = timeframeToDateRange("this-month");
    if (filters.from === fm && filters.to === tm) return "this-month";
    const { from: fl, to: tl } = timeframeToDateRange("last-month");
    if (filters.from === fl && filters.to === tl) return "last-month";
    const { from: fy } = timeframeToDateRange("this-year");
    if (filters.from === fy) return "this-year";
    return "all";
  })();

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Invoices">
        {uninvoicedCount > 0 && (
          <Badge variant="secondary">
            {uninvoicedCount} groups ready to invoice
          </Badge>
        )}
        <Button size="sm" className="hidden md:flex" disabled={loading}>
          <Plus className="size-4" />
          New invoice
        </Button>
      </PageHeader>

      {/* Desktop table */}
      <div className="hidden md:flex flex-col flex-1 overflow-y-auto">
        <div className="px-4 md:px-6 py-6 mx-auto w-full max-w-6xl flex flex-col gap-4 flex-1">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search invoices..."
                className="pl-8"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onBlur={() => handleSearchCommit(searchValue)}
                onKeyDown={(e) => e.key === "Enter" && handleSearchCommit(searchValue)}
                disabled={loading}
              />
            </div>
            <Select
              value={currentTimeframe}
              onValueChange={(v) => {
                const range = timeframeToDateRange(v);
                pushParams({ from: range.from, to: range.to });
              }}
              disabled={loading}
            >
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Timeframe" />
              </SelectTrigger>
              <SelectContent>
                {TIMEFRAME_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.clientId ?? "all"}
              onValueChange={(v) => pushParams({ client: v === "all" ? undefined : v })}
              disabled={loading}
            >
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Client" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All clients</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.status ?? "all"}
              onValueChange={(v) => pushParams({ status: v === "all" ? undefined : v })}
              disabled={loading}
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="issued">Issued</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead className="w-36 py-4 px-6" {...sh("issued_date")}>Dates</SortableTableHead>
                  <SortableTableHead className="w-24 py-4 px-6" {...sh("number")}>Number</SortableTableHead>
                  <SortableTableHead className="py-4 px-6" {...sh("client")}>Client</SortableTableHead>
                  <TableHead className="w-16 text-right py-4 px-6">Lines</TableHead>
                  <SortableTableHead className="w-28 py-4 px-6" {...sh("issued_date")}>Issued</SortableTableHead>
                  <SortableTableHead className="w-28 py-4 px-6" align="right" {...sh("total")}>Total</SortableTableHead>
                  <SortableTableHead className="w-24 py-4 px-6" align="right" {...sh("status")}>Status</SortableTableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <SkeletonTableRows />
                ) : invoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                      No invoices match these filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  invoices.map((inv) => (
                    <TableRow key={inv.id} className="cursor-pointer" onClick={() => openInvoice(inv)}>
                      <TableCell className="text-sm text-muted-foreground py-4 px-6">
                        {inv.date_range}
                      </TableCell>
                      <TableCell className="font-medium text-sm py-4 px-6">
                        {inv.number}
                      </TableCell>
                      <TableCell className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <div
                            className="size-2 rounded-full shrink-0"
                            style={{ backgroundColor: inv.client.color }}
                          />
                          <span className="text-sm">{inv.client.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-right text-muted-foreground tabular-nums py-4 px-6">
                        {inv.entry_count}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground py-4 px-6">
                        {formatDateShort(inv.issued_date)}
                      </TableCell>
                      <TableCell className="text-sm text-right tabular-nums py-4 px-6">
                        {formatAUD(inv.total)}
                      </TableCell>
                      <TableCell className="py-4 px-6 text-right">
                        <StatusBadge
                          status={localStatuses[inv.id] ?? inv.status}
                          onStatusChange={(s) => handleStatusChange(inv.id, s)}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {!loading && (
            loadPending ? (
              <SkeletonTableRows count={4} />
            ) : (
              <div className="text-center py-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground"
                  onClick={handleLoadMore}
                >
                  Load more
                </Button>
              </div>
            )
          )}
        </div>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden flex-1 overflow-y-auto">
        {loading ? (
          <SkeletonMobileCards />
        ) : invoices.length === 0 ? (
          <Empty className="h-64">
            <EmptyHeader>
              <EmptyMedia variant="icon"><FileText /></EmptyMedia>
              <EmptyTitle>No invoices yet</EmptyTitle>
              <EmptyDescription>Invoices you create will appear here.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="px-4 py-4 flex flex-col gap-3">
            {invoices.map((inv) => (
              <Card key={inv.id} className="py-0" onClick={() => openInvoice(inv)}>
                <CardContent className="p-0">
                  <InvoiceCard invoice={inv} />
                </CardContent>
              </Card>
            ))}
            {loadPending ? (
              <SkeletonMobileCards count={3} />
            ) : (
              <div className="text-center py-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground"
                  onClick={handleLoadMore}
                >
                  Load more
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <InvoiceSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        invoice={selectedInvoice}
      />
    </div>
  );
}
