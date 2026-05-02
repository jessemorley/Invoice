"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { revalidateInvoices, loadScheduledEmail, cancelScheduledEmail, sendScheduledEmailNow, loadEntrySheetData } from "./actions";
import { invalidate } from "@/lib/invalidate";
import type { Invoice, InvoiceStatus, InvoiceDetail, Entry, Client, WorkflowRate } from "@/lib/types";
import type { ScheduledEmail } from "@/lib/queries";
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
import { GenerateSheet } from "@/components/generate-sheet";
import { EmailComposeSheet } from "@/components/email-compose-sheet";
import { EntrySheet } from "@/components/entry-sheet";
import { ChevronDown, FileText, Plus, RefreshCw, Search, X } from "lucide-react";

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
            {invoice.issued_date ? formatDateShort(invoice.issued_date) : "—"}
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
  loading?: boolean;
};

const EMPTY_INVOICES: Invoice[] = [];
const EMPTY_CLIENTS: { id: string; name: string }[] = [];
const PAGE_SIZE = 25;

export function InvoicesClient({ invoices: initialInvoices = EMPTY_INVOICES, uninvoicedCount = 0, clients = EMPTY_CLIENTS, loading = false }: Props) {
  const mobileScrollRef = useRef<HTMLDivElement>(null);
  const handlePullRefresh = useCallback(async () => {
    await revalidateInvoices();
    invalidate("invoices");
  }, []);
  const { pullDistance, state: pullState } = usePullToRefresh({
    ref: mobileScrollRef,
    onRefresh: handlePullRefresh,
    enabled: !loading,
  });

  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const [localStatuses, setLocalStatuses] = useState<Record<string, InvoiceStatus>>(
    () => Object.fromEntries(initialInvoices.map((inv) => [inv.id, inv.status]))
  );
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [scheduledEmail, setScheduledEmail] = useState<ScheduledEmail | null>(null);
  const [invoiceDetail, setInvoiceDetail] = useState<InvoiceDetail | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [entrySheetOpen, setEntrySheetOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
  const entrySheetMeta = useState<{ clients: Client[]; workflowRates: WorkflowRate[] } | null>(null);
  const [entrySheetData, setEntrySheetData] = entrySheetMeta;
  const [searchOpen, setSearchOpen] = useState(false);
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    const handler = () => {
      if (!searchOpen) setSearchOpen(true);
      else searchInputRef.current?.focus();
    };
    window.addEventListener("dock:focus-search", handler);
    return () => window.removeEventListener("dock:focus-search", handler);
  }, [searchOpen]);

  const [searchValue, setSearchValue] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [timeframe, setTimeframe] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("issued_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    setInvoices(initialInvoices);
    setLocalStatuses(Object.fromEntries(initialInvoices.map((inv) => [inv.id, inv.status])));
  }, [initialInvoices]);

  // Reset visible window whenever filters or sort change
  useEffect(() => {
    setDisplayCount(PAGE_SIZE);
  }, [searchValue, statusFilter, clientFilter, timeframe, sortKey, sortDir]);

  const filteredInvoices = useMemo(() => {
    let result = invoices.map((inv) => ({
      ...inv,
      status: localStatuses[inv.id] ?? inv.status,
    }));

    if (searchValue.trim()) {
      const q = searchValue.trim().toLowerCase();
      result = result.filter(
        (inv) =>
          inv.number.toLowerCase().includes(q) ||
          inv.client.name.toLowerCase().includes(q)
      );
    }

    if (statusFilter !== "all") {
      result = result.filter((inv) => inv.status === statusFilter);
    }

    if (clientFilter !== "all") {
      result = result.filter((inv) => inv.client.id === clientFilter);
    }

    if (timeframe !== "all") {
      const { from, to } = timeframeToDateRange(timeframe);
      if (from) result = result.filter((inv) => inv.issued_date == null || inv.issued_date >= from);
      if (to) result = result.filter((inv) => inv.issued_date == null || inv.issued_date <= to);
    }

    const dir = sortDir === "asc" ? 1 : -1;
    result = [...result].sort((a, b) => {
      switch (sortKey) {
        case "issued_date": return dir * ((a.issued_date ?? "9999-99-99").localeCompare(b.issued_date ?? "9999-99-99"));
        case "number":      return dir * a.number.localeCompare(b.number);
        case "client":      return dir * a.client.name.localeCompare(b.client.name);
        case "total":       return dir * (a.total - b.total);
        case "status":      return dir * a.status.localeCompare(b.status);
      }
    });

    return result;
  }, [invoices, localStatuses, searchValue, statusFilter, clientFilter, timeframe, sortKey, sortDir]);

  const visibleInvoices = filteredInvoices.slice(0, displayCount);
  const hasMore = displayCount < filteredInvoices.length;

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 400 && hasMore) {
      setDisplayCount((prev) => Math.min(prev + PAGE_SIZE, filteredInvoices.length));
    }
  }

  function openInvoice(inv: Invoice) {
    setSelectedInvoice(inv);
    setScheduledEmail(null);
    setInvoiceDetail(null);
    setSheetOpen(true);
    loadScheduledEmail(inv.id).then((result) => {
      setScheduledEmail(result.scheduledEmail);
      setInvoiceDetail(result.invoiceDetail);
      setBusinessName(result.businessName);
    });
  }

  function handleEntryClick(entryId: string) {
    setSheetOpen(false);
    setEntrySheetOpen(true);
    loadEntrySheetData(entryId).then(({ entry, clients, workflowRates }) => {
      if (entry) setSelectedEntry(entry);
      if (!entrySheetData) setEntrySheetData({ clients, workflowRates });
    });
  }

  function handleSendClick() {
    setSheetOpen(false);
    setComposeOpen(true);
  }

  async function handleCancelEmail(id: string) {
    await cancelScheduledEmail(id);
    invalidate("invoices");
    setScheduledEmail(null);
  }

  function handleReschedule() {
    setSheetOpen(false);
    setComposeOpen(true);
  }

  async function handleSendNow(id: string) {
    await sendScheduledEmailNow(id);
    invalidate("invoices");
    setScheduledEmail((prev) => prev ? { ...prev, scheduled_for: new Date().toISOString() } : prev);
  }

  function handleSort(key: SortKey) {
    const newDir = sortKey === key && sortDir === "asc" ? "desc" : "asc";
    setSortKey(key);
    setSortDir(newDir);
  }

  function handleStatusChange(id: string, status: InvoiceStatus) {
    setLocalStatuses((prev) => ({ ...prev, [id]: status }));
  }

  function sh(key: SortKey) {
    return { active: sortKey === key, dir: sortDir, onSort: () => handleSort(key) };
  }

  function closeSearch() {
    setSearchOpen(false);
    setSearchValue("");
  }

  const mobileTitle = searchOpen ? (
    <input
      ref={searchInputRef}
      className="text-lg font-semibold bg-transparent border-none outline-none w-full text-foreground placeholder:font-normal placeholder:text-muted-foreground/60"
      placeholder="Search invoices..."
      value={searchValue}
      onChange={(e) => setSearchValue(e.target.value)}
      onKeyDown={(e) => e.key === "Escape" && closeSearch()}
    />
  ) : (
    <span className="text-lg font-semibold">Invoices</span>
  );

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Invoices" mobileTitle={mobileTitle}>
        {uninvoicedCount > 0 && (
          <button onClick={() => setGenerateOpen(true)}>
            <Badge variant="secondary" className="cursor-pointer">
              {uninvoicedCount} {uninvoicedCount === 1 ? "group" : "groups"} ready to invoice
            </Badge>
          </button>
        )}
        <Button size="icon" variant="ghost" className="size-8 md:hidden" onClick={() => searchOpen ? closeSearch() : setSearchOpen(true)} disabled={loading}>
          {searchOpen ? <X className="size-4" /> : <Search className="size-4" />}
        </Button>
        <Button size="sm" className="hidden md:flex" disabled={loading}>
          <Plus className="size-4" />
          New invoice
        </Button>
      </PageHeader>

      {/* Desktop table */}
      <div className="hidden md:flex flex-col flex-1 overflow-y-auto" onScroll={handleScroll}>
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
                disabled={loading}
              />
            </div>
            <Select value={timeframe} onValueChange={setTimeframe} disabled={loading}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Timeframe" />
              </SelectTrigger>
              <SelectContent>
                {TIMEFRAME_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={clientFilter} onValueChange={setClientFilter} disabled={loading}>
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
            <Select value={statusFilter} onValueChange={setStatusFilter} disabled={loading}>
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
                  <SortableTableHead className="w-28 py-4 px-6" {...sh("issued_date")}>Issued</SortableTableHead>
                  <SortableTableHead className="w-24 py-4 px-6" {...sh("number")}>Number</SortableTableHead>
                  <SortableTableHead className="py-4 px-6" {...sh("client")}>Client</SortableTableHead>
                  <SortableTableHead className="w-28 py-4 px-6" align="right" {...sh("total")}>Total</SortableTableHead>
                  <SortableTableHead className="w-24 py-4 px-6" align="right" {...sh("status")}>Status</SortableTableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <SkeletonTableRows />
                ) : filteredInvoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                      No invoices match these filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleInvoices.map((inv) => (
                    <TableRow key={inv.id} className="cursor-pointer" onClick={() => openInvoice(inv)}>
                      <TableCell className="text-sm text-muted-foreground py-4 px-6">
                        {inv.issued_date ? formatDateShort(inv.issued_date) : "—"}
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
        </div>
      </div>

      {/* Mobile filter bar */}
      <div className="md:hidden border-b px-4 py-2 flex gap-2">
        <Select value={timeframe} onValueChange={setTimeframe} disabled={loading}>
          <SelectTrigger size="sm" className="flex-1 min-w-0 text-xs">
            <SelectValue placeholder="Timeframe" />
          </SelectTrigger>
          <SelectContent>
            {TIMEFRAME_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter} disabled={loading}>
          <SelectTrigger size="sm" className="flex-1 min-w-0 text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="issued">Issued</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
          </SelectContent>
        </Select>
        <Select value={clientFilter} onValueChange={setClientFilter} disabled={loading}>
          <SelectTrigger size="sm" className="flex-1 min-w-0 text-xs">
            <SelectValue placeholder="Client" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All clients</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Mobile card list */}
      <div
        ref={mobileScrollRef}
        className="md:hidden flex-1 overflow-y-auto"
        onScroll={handleScroll}
      >
        {/* Pull-to-refresh indicator — sits at top of scroll content, hidden until pulled */}
        <div
          className="flex items-center justify-center overflow-hidden pointer-events-none"
          style={{ height: pullState !== "idle" ? pullDistance : 0 }}
        >
          <RefreshCw
            className={`size-5 text-muted-foreground ${pullState === "refreshing" ? "animate-spin" : ""}`}
            style={{ transform: pullState !== "refreshing" ? `rotate(${(pullDistance / 70) * 180}deg)` : undefined }}
          />
        </div>
        {loading ? (
          <SkeletonMobileCards />
        ) : filteredInvoices.length === 0 ? (
          <Empty className="h-64">
            <EmptyHeader>
              <EmptyMedia variant="icon"><FileText /></EmptyMedia>
              <EmptyTitle>No invoices yet</EmptyTitle>
              <EmptyDescription>Invoices you create will appear here.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="px-4 py-4 pb-28 flex flex-col gap-3">
            {visibleInvoices.map((inv) => (
              <Card key={inv.id} className="py-0" onClick={() => openInvoice(inv)}>
                <CardContent className="p-0">
                  <InvoiceCard invoice={inv} />
                </CardContent>
              </Card>
            ))}
            {hasMore && <div className="h-8" />}
          </div>
        )}
      </div>

      <InvoiceSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        invoice={selectedInvoice}
        invoiceDetail={invoiceDetail}
        scheduledEmail={scheduledEmail}
        onSendClick={handleSendClick}
        onCancelEmail={handleCancelEmail}
        onReschedule={handleReschedule}
        onSendNow={handleSendNow}
        onEntryClick={handleEntryClick}
      />
      <EntrySheet
        open={entrySheetOpen}
        onOpenChange={(open) => {
          setEntrySheetOpen(open);
          if (!open) setSheetOpen(true);
        }}
        entry={selectedEntry}
        clients={entrySheetData?.clients ?? []}
        workflowRates={entrySheetData?.workflowRates ?? []}
      />
      <EmailComposeSheet
        open={composeOpen}
        onOpenChange={(open) => {
          setComposeOpen(open);
          if (!open) setSheetOpen(true);
        }}
        invoice={invoiceDetail}
        businessName={businessName}
        onSent={() => invalidate("invoices")}
      />
      <GenerateSheet
        open={generateOpen}
        onOpenChange={setGenerateOpen}
      />
    </div>
  );
}
