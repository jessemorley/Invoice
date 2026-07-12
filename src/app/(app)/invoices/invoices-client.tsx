"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { ClientSquircle } from "@/components/client-squircle";
import { InvoiceStatusBadge, INVOICE_STATUS_COLOR } from "@/components/invoice-status-badge";
import { revalidateInvoices, loadScheduledEmail, cancelScheduledEmail, sendScheduledEmailNow, loadEntrySheetData, generateInvoices } from "./actions";
import { invalidate } from "@/lib/invalidate";
import type { ComposePrefill, Invoice, InvoiceEmail, InvoiceStatus, InvoiceDetail, Entry, Client, WorkflowRate } from "@/lib/types";
import type { ScheduledEmail, SuggestedInvoice } from "@/lib/queries";
import type { InvoiceFilters } from "@/lib/queries";
import type { GeneratedInvoice } from "./actions";
import { formatAUD, formatDateShort, toLocalDateStr } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
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
import { SortableTableHead, tableHeadCellBase } from "@/components/sortable-table-head";
import { cn } from "@/lib/utils";
import { ViewHeader } from "@/components/view-header";
import { InvoiceSheet } from "@/components/invoice-sheet";
import { SentEmailSheet } from "@/components/sent-email-sheet";
import { GenerateSheet } from "@/components/generate-sheet";
import { SuggestedInvoiceSheet } from "@/components/suggested-invoice-sheet";
import { EmailComposeSheet } from "@/components/email-compose-sheet";
import { RescheduleDialog } from "@/components/reschedule-dialog";
import { EntrySheet } from "@/components/entry-sheet";
import { ChevronDown, Clock, FileText, MailWarning, Plus, RefreshCw, Search, Send } from "lucide-react";

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

const EMAIL_VARIANT: Record<InvoiceEmail["status"], "default" | "secondary" | "destructive"> = {
  pending: "secondary",
  sent:    "secondary",
  failed:  "destructive",
};

function EmailBadge({ email, showDate = false }: { email: InvoiceEmail; showDate?: boolean }) {
  const date = email.status === "sent" && email.sent_at
    ? formatDateShort(email.sent_at.slice(0, 10))
    : email.status === "pending"
    ? formatDateShort(toLocalDateStr(new Date(email.scheduled_for)))
    : null;

  return (
    <Badge variant={EMAIL_VARIANT[email.status]} className="h-5 py-0">
      {email.status === "sent" && <Send />}
      {email.status === "pending" && <Clock />}
      {email.status === "failed" && <MailWarning />}
      {showDate && date && <span>{date}</span>}
    </Badge>
  );
}

function emailStatus(email: InvoiceEmail | null): { text: string; icon: typeof Send; destructive?: boolean } | null {
  if (email?.status === "sent") return { text: "Sent", icon: Send };
  if (email?.status === "pending") return { text: "Scheduled", icon: Clock };
  if (email?.status === "failed") return { text: "Failed", icon: MailWarning, destructive: true };
  return null;
}

function InvoiceCard({ invoice }: { invoice: Invoice }) {
  const email = emailStatus(invoice.email);
  return (
    <div className="flex items-start gap-3 px-4 py-3 hover:bg-accent/50 transition-colors cursor-pointer">
      <div className="flex flex-col w-16 shrink-0">
        <span className="text-sm font-medium text-foreground tabular-nums truncate">{invoice.number}</span>
        {email && (
          <span
            className={cn(
              "flex items-center gap-1 text-xs mt-0.5",
              email.destructive ? "text-destructive" : "text-muted-foreground"
            )}
          >
            <email.icon className="size-3 shrink-0" />
            {email.text}
          </span>
        )}
      </div>
      <div className="flex flex-1 min-w-0 items-center gap-2">
        <ClientSquircle name={invoice.client.name} color={invoice.client.color} className="size-8" />
        <div className="min-w-0">
          <span className="text-sm text-foreground truncate block">{invoice.client.name}</span>
          <span className="text-xs text-muted-foreground mt-0.5 block">
            {invoice.issued_date ? formatDateShort(invoice.issued_date) : "—"}
          </span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-0.5 shrink-0">
        <span className="text-sm tabular-nums text-foreground">{formatAUD(invoice.subtotal)}</span>
        <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0 text-xs font-medium text-muted-foreground">
          <span
            className="size-1.5 rounded-full shrink-0"
            style={{ backgroundColor: INVOICE_STATUS_COLOR[invoice.status] }}
          />
          {STATUS_LABEL[invoice.status]}
        </span>
      </div>
    </div>
  );
}

function SuggestedInvoiceCard({ group, creating, onCreate }: { group: SuggestedInvoice; creating: boolean; onCreate: () => void }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 hover:bg-accent/50 transition-colors cursor-pointer opacity-70">
      <div className="flex w-16 shrink-0 self-stretch items-center">
        <Button
          variant="outline"
          size="xs"
          disabled={creating}
          onClick={(e) => { e.stopPropagation(); onCreate(); }}
        >
          {creating ? <Spinner /> : "Create"}
        </Button>
      </div>
      <div className="flex flex-1 min-w-0 items-center gap-2">
        <ClientSquircle name={group.clientName} color={group.clientColor} className="size-8" />
        <div className="min-w-0">
          <span className="text-sm text-foreground truncate block">{group.clientName}</span>
          <span className="text-xs text-muted-foreground mt-0.5 block truncate">
            {group.dateRange} · {group.entryCount} {group.entryCount === 1 ? "entry" : "entries"}
          </span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-0.5 shrink-0">
        <span className="text-sm tabular-nums text-foreground">{formatAUD(group.subtotal)}</span>
        <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0 text-xs font-medium text-muted-foreground">
          <span
            className="size-1.5 rounded-full shrink-0"
            style={{ backgroundColor: group.ready ? "#3b82f6" : "#9ca3af" }}
          />
          {group.ready ? "Ready" : "In progress"}
        </span>
      </div>
    </div>
  );
}

function SkeletonTableRows({ count = 8 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <TableRow key={i}>
          <TableCell className="py-3 px-6"><Skeleton className="h-5 w-24 rounded-full" /></TableCell>
          <TableCell className="py-3 px-6"><Skeleton className="h-4 w-16" /></TableCell>
          <TableCell className="py-3 px-6">
            <div className="flex items-center gap-3">
              <Skeleton className="size-7 shrink-0" style={{ borderRadius: "30%" }} />
              <Skeleton className="h-4 w-28" />
            </div>
          </TableCell>
          <TableCell className="py-3 px-6"><Skeleton className="h-5 w-12 rounded-full" /></TableCell>
          <TableCell className="py-3 px-6 text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
          <TableCell className="py-3 px-6 text-right"><Skeleton className="h-5 w-14 ml-auto rounded-full" /></TableCell>
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
              <div className="flex flex-col gap-1.5 w-16 shrink-0">
                <Skeleton className="h-3 w-14" />
                <Skeleton className="h-3 w-12" />
              </div>
              <div className="flex-1 flex items-center gap-2">
                <Skeleton className="size-8 rounded-[30%] shrink-0" />
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-5 w-14 rounded-full" />
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
  hasUninvoiced?: boolean;
  clients?: Client[];
  suggested?: SuggestedInvoice[];
  loading?: boolean;
};

const EMPTY_INVOICES: Invoice[] = [];
const EMPTY_CLIENTS: Client[] = [];
const EMPTY_SUGGESTED: SuggestedInvoice[] = [];
const PAGE_SIZE = 25;

export function InvoicesClient({ invoices: initialInvoices = EMPTY_INVOICES, uninvoicedCount = 0, hasUninvoiced = uninvoicedCount > 0, clients = EMPTY_CLIENTS, suggested = EMPTY_SUGGESTED, loading = false }: Props) {
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

  const [statusOverrides, setStatusOverrides] = useState<Record<string, InvoiceStatus>>({});
  const [prevInitialInvoices, setPrevInitialInvoices] = useState(initialInvoices);

  if (prevInitialInvoices !== initialInvoices) {
    setPrevInitialInvoices(initialInvoices);
    setStatusOverrides({});
  }

  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [scheduledEmail, setScheduledEmail] = useState<ScheduledEmail | null>(null);
  const [invoiceDetail, setInvoiceDetail] = useState<InvoiceDetail | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [sentEmailOpen, setSentEmailOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composePrefill, setComposePrefill] = useState<ComposePrefill | null>(null);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const composeSentRef = useRef(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [newInvoiceOpen, setNewInvoiceOpen] = useState(false);
  const [suggestedOpen, setSuggestedOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<SuggestedInvoice | null>(null);
  const [creatingKey, setCreatingKey] = useState<string | null>(null);
  const entryReturnRef = useRef<"invoice" | "suggested">("invoice");
  const [entrySheetOpen, setEntrySheetOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
  const entrySheetMeta = useState<{ clients: Client[]; workflowRates: WorkflowRate[] } | null>(null);
  const [entrySheetData, setEntrySheetData] = entrySheetMeta;
  const [filterOpen, setFilterOpen] = useState(false);
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== "invoices") return;
      if (hasUninvoiced) {
        setGenerateOpen(true);
      } else {
        setNewInvoiceOpen(true);
      }
    };
    window.addEventListener("dock:new", handler);
    return () => window.removeEventListener("dock:new", handler);
  }, [hasUninvoiced]);

  const [searchValue, setSearchValue] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [timeframe, setTimeframe] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("issued_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const filterKey = `${searchValue}|${statusFilter}|${clientFilter}|${timeframe}|${sortKey}|${sortDir}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (prevFilterKey !== filterKey) {
    setPrevFilterKey(filterKey);
    setDisplayCount(PAGE_SIZE);
  }

  const filteredInvoices = useMemo(() => {
    let result = initialInvoices.map((inv) => ({
      ...inv,
      status: statusOverrides[inv.id] ?? inv.status,
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
        case "total":       return dir * (a.subtotal - b.subtotal);
        case "status":      return dir * a.status.localeCompare(b.status);
      }
    });

    return result;
  }, [initialInvoices, statusOverrides, searchValue, statusFilter, clientFilter, timeframe, sortKey, sortDir]);

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

  function handleSuggestedCreated(created: GeneratedInvoice, group: SuggestedInvoice | null) {
    const client = clients.find((c) => c.id === created.clientId);
    openInvoice({
      id: created.id,
      number: created.number,
      client: {
        id: created.clientId,
        name: client?.name ?? group?.clientName ?? "",
        color: client?.color ?? group?.clientColor ?? "#9ca3af",
        billing_type: client?.billing_type ?? "day_rate",
      },
      issued_date: null,
      due_date: null,
      paid_date: null,
      subtotal: created.subtotal,
      super_amount: created.super_amount,
      total: created.total,
      status: "draft",
      email: null,
      notes: null,
    });
  }

  async function handleQuickCreate(group: SuggestedInvoice) {
    setCreatingKey(group.key);
    try {
      const { invoices } = await generateInvoices([group.key]);
      invalidate("invoices", "entries");
      if (invoices[0]) handleSuggestedCreated(invoices[0], group);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create invoice");
    } finally {
      setCreatingKey(null);
    }
  }

  function handleEntryClick(entryId: string, from: "invoice" | "suggested" = "invoice") {
    entryReturnRef.current = from;
    if (from === "suggested") setSuggestedOpen(false);
    else setSheetOpen(false);
    setEntrySheetOpen(true);
    loadEntrySheetData(entryId).then(({ entry, clients, workflowRates }) => {
      if (entry) setSelectedEntry(entry);
      if (!entrySheetData) setEntrySheetData({ clients, workflowRates });
    });
  }

  function handleSendClick() {
    setSheetOpen(false);
    setComposePrefill(null);
    setComposeOpen(true);
  }

  async function handleCancelEmail(id: string) {
    await cancelScheduledEmail(id);
    invalidate("invoices");
    setScheduledEmail(null);
  }

  function handleEditEmail() {
    if (!scheduledEmail) return;
    setComposePrefill({
      to: scheduledEmail.to_address.split(",").map((s) => s.trim()).filter(Boolean),
      subject: scheduledEmail.subject,
      body: scheduledEmail.body_text,
      scheduledFor: new Date(scheduledEmail.scheduled_for),
      editingId: scheduledEmail.id,
    });
    setSheetOpen(false);
    setComposeOpen(true);
  }

  function handleReschedule() {
    if (!scheduledEmail) return;
    setSheetOpen(false);
    setRescheduleOpen(true);
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
    setStatusOverrides((prev) => ({ ...prev, [id]: status }));
  }

  function sh(key: SortKey) {
    return { active: sortKey === key, dir: sortDir, onSort: () => handleSort(key) };
  }

  const hasActiveFilters = timeframe !== "all" || statusFilter !== "all" || clientFilter !== "all";

  return (
    <div className="flex flex-col h-full">
      <ViewHeader
        title="Invoices"
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        filterOpen={filterOpen}
        filterActive={hasActiveFilters}
        onFilterToggle={() => setFilterOpen((o) => !o)}
        loading={loading}
        actions={
          <Button
            size="sm"
            className="relative hidden md:flex"
            disabled={loading}
            onClick={() => hasUninvoiced ? setGenerateOpen(true) : setNewInvoiceOpen(true)}
          >
            {uninvoicedCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground leading-none">
                {uninvoicedCount}
              </span>
            )}
            <Plus className="size-4" />
            Add invoice
          </Button>
        }
      />

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

          <div className="rounded-lg border overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <SortableTableHead className={cn(tableHeadCellBase, "w-24")} {...sh("number")}>Number</SortableTableHead>
                <SortableTableHead className={cn(tableHeadCellBase, "w-28")} {...sh("issued_date")}>Issued</SortableTableHead>
                <SortableTableHead className={cn(tableHeadCellBase)} {...sh("client")}>Client</SortableTableHead>
                <TableHead className={cn(tableHeadCellBase, "w-36")}>Email</TableHead>
                <SortableTableHead className={cn(tableHeadCellBase, "w-28")} align="right" {...sh("total")}>Total</SortableTableHead>
                <SortableTableHead className={cn(tableHeadCellBase, "w-24")} align="right" {...sh("status")}>Status</SortableTableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <SkeletonTableRows />
              ) : filteredInvoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                    No invoices match these filters.
                  </TableCell>
                </TableRow>
              ) : (
                visibleInvoices.map((inv) => (
                  <TableRow key={inv.id} className="cursor-pointer" onClick={() => openInvoice(inv)}>
                    <TableCell className="py-3 px-6">
                      <InvoiceStatusBadge number={inv.number} status={inv.status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground py-3 px-6">
                      {inv.issued_date ? formatDateShort(inv.issued_date) : "—"}
                    </TableCell>
                    <TableCell className="py-3 px-6">
                      <div className="flex items-center gap-3">
                        <ClientSquircle name={inv.client.name} color={inv.client.color} />
                        <span className="text-sm">{inv.client.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-3 px-6">
                      {inv.email && <EmailBadge email={inv.email} showDate />}
                    </TableCell>
                    <TableCell className="text-sm text-right tabular-nums py-3 px-6">
                      {formatAUD(inv.subtotal)}
                    </TableCell>
                    <TableCell className="py-3 px-6 text-right">
                      <StatusBadge
                        status={inv.status}
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

      {/* Mobile filter bar — collapsible */}
      <div className={`md:hidden grid transition-[grid-template-rows] duration-200 ease-out ${filterOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          <div className="border-b px-4 py-2 flex gap-2">
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
        </div>
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
        {/* Suggested invoices — not real invoices, so search/filters don't apply */}
        {!loading && suggested.length > 0 && (
          <div className="px-4 pt-4 flex flex-col gap-3">
            {suggested.map((g) => (
              <Card
                key={g.key}
                className="py-0 border-dashed"
                onClick={() => { setSelectedGroup(g); setSuggestedOpen(true); }}
              >
                <CardContent className="p-0">
                  <SuggestedInvoiceCard
                    group={g}
                    creating={creatingKey === g.key}
                    onCreate={() => handleQuickCreate(g)}
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
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
        onOpenChangeAction={setSheetOpen}
        invoice={selectedInvoice}
        invoiceDetail={invoiceDetail}
        scheduledEmail={scheduledEmail}
        onSendClick={handleSendClick}
        onCancelEmail={handleCancelEmail}
        onEditEmail={handleEditEmail}
        onReschedule={handleReschedule}
        onSendNow={handleSendNow}
        onViewEmail={() => setSentEmailOpen(true)}
        onEntryClick={handleEntryClick}
        onLineItemMutate={() => {
          if (selectedInvoice) {
            loadScheduledEmail(selectedInvoice.id).then((result) => {
              setScheduledEmail(result.scheduledEmail);
              setInvoiceDetail(result.invoiceDetail);
            });
          }
        }}
      />
      <SentEmailSheet
        open={sentEmailOpen}
        onOpenChangeAction={setSentEmailOpen}
        email={scheduledEmail && selectedInvoice && scheduledEmail.status !== "cancelled" ? {
          ...scheduledEmail,
          status: scheduledEmail.status as "pending" | "sent" | "failed",
          invoice_id: selectedInvoice.id,
          invoice_number: selectedInvoice.number,
          invoice_status: selectedInvoice.status,
        } : null}
      />
      <EntrySheet
        open={entrySheetOpen}
        onOpenChangeAction={(open) => {
          setEntrySheetOpen(open);
          if (!open) {
            if (entryReturnRef.current === "suggested") setSuggestedOpen(true);
            else setSheetOpen(true);
          }
        }}
        entry={selectedEntry}
        clients={entrySheetData?.clients ?? []}
        workflowRates={entrySheetData?.workflowRates ?? []}
      />
      <EmailComposeSheet
        open={composeOpen}
        onOpenChangeAction={(open) => {
          setComposeOpen(open);
          if (!open && !composeSentRef.current) setSheetOpen(true);
          if (!open) { composeSentRef.current = false; setComposePrefill(null); }
        }}
        invoice={invoiceDetail}
        businessName={businessName}
        onSent={() => { composeSentRef.current = true; invalidate("invoices"); }}
        initialTo={composePrefill?.to}
        initialSubject={composePrefill?.subject}
        initialBody={composePrefill?.body}
        initialScheduledFor={composePrefill?.scheduledFor}
        editingId={composePrefill?.editingId}
      />
      <RescheduleDialog
        open={rescheduleOpen}
        onOpenChangeAction={(open) => {
          setRescheduleOpen(open);
          if (!open) setSheetOpen(true);
        }}
        scheduledEmailId={scheduledEmail?.id ?? null}
        currentScheduledFor={scheduledEmail?.scheduled_for ?? null}
        onRescheduled={(iso) => {
          setScheduledEmail((prev) => prev ? { ...prev, scheduled_for: iso } : prev);
        }}
      />
      <GenerateSheet
        open={generateOpen}
        onOpenChangeAction={setGenerateOpen}
        onBlankInvoiceAction={() => setNewInvoiceOpen(true)}
      />
      <SuggestedInvoiceSheet
        open={suggestedOpen}
        onOpenChangeAction={setSuggestedOpen}
        group={selectedGroup}
        onCreatedAction={(inv) => handleSuggestedCreated(inv, selectedGroup)}
        onEntryClick={(id) => handleEntryClick(id, "suggested")}
      />
      <InvoiceSheet
        open={newInvoiceOpen}
        onOpenChangeAction={setNewInvoiceOpen}
        invoice={null}
        clients={clients}
      />
    </div>
  );
}
