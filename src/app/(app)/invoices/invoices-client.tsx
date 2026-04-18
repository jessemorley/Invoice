"use client";

import { useState } from "react";
import type { Entry, Invoice, InvoiceStatus } from "@/lib/types";
import { formatAUD, formatDateShort } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { ChevronDown, FileText, Plus, Search } from "lucide-react";

type SortKey = "number" | "client" | "dates" | "issued" | "total" | "status";
type SortDir = "asc" | "desc";

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

function uninvoicedGroupCount(entries: Entry[]): number {
  const uninvoiced = entries.filter((e) => !e.invoice_id);
  const groups = new Set(uninvoiced.map((e) => `${e.client.id}-${e.iso_week}`));
  return groups.size;
}

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

export function InvoicesClient({ invoices, entries }: { invoices: Invoice[]; entries: Entry[] }) {
  const uninvoicedCount = uninvoicedGroupCount(entries);
  const [sortKey, setSortKey] = useState<SortKey>("dates");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [statuses, setStatuses] = useState<Record<string, InvoiceStatus>>(
    () => Object.fromEntries(invoices.map((inv) => [inv.id, inv.status]))
  );

  const uniqueClients = Array.from(
    new Map(invoices.map((inv) => [inv.client.id, inv.client])).values()
  );

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function handleStatusChange(id: string, status: InvoiceStatus) {
    setStatuses((prev) => ({ ...prev, [id]: status }));
  }

  const sorted = [...invoices].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case "number":  cmp = a.number.localeCompare(b.number); break;
      case "client":  cmp = a.client.name.localeCompare(b.client.name); break;
      case "dates":   cmp = a.issued_date.localeCompare(b.issued_date); break;
      case "issued":  cmp = a.issued_date.localeCompare(b.issued_date); break;
      case "total":   cmp = a.total - b.total; break;
      case "status":  cmp = (statuses[a.id] ?? a.status).localeCompare(statuses[b.id] ?? b.status); break;
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  function sh(key: SortKey) {
    return { active: sortKey === key, dir: sortDir, onSort: () => handleSort(key) };
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Invoices">
        {uninvoicedCount > 0 && (
          <Badge variant="secondary">
            {uninvoicedCount} groups ready to invoice
          </Badge>
        )}
        <Button size="sm" className="hidden md:flex">
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
              <Input placeholder="Search invoices..." className="pl-8" />
            </div>
            <Select defaultValue="all-time">
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Timeframe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all-time">All time</SelectItem>
                <SelectItem value="this-week">This week</SelectItem>
                <SelectItem value="this-month">This month</SelectItem>
                <SelectItem value="last-month">Last month</SelectItem>
                <SelectItem value="this-year">This year</SelectItem>
              </SelectContent>
            </Select>
            <Select defaultValue="all-clients">
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Client" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all-clients">All clients</SelectItem>
                {uniqueClients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select defaultValue="all-status">
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all-status">All status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="issued">Issued</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead className="w-36 py-4 px-6" {...sh("dates")}>Dates</SortableTableHead>
                  <SortableTableHead className="w-24 py-4 px-6" {...sh("number")}>Number</SortableTableHead>
                  <SortableTableHead className="py-4 px-6" {...sh("client")}>Client</SortableTableHead>
                  <TableHead className="w-16 text-right py-4 px-6">Lines</TableHead>
                  <SortableTableHead className="w-28 py-4 px-6" {...sh("issued")}>Issued</SortableTableHead>
                  <SortableTableHead className="w-28 py-4 px-6" align="right" {...sh("total")}>Total</SortableTableHead>
                  <SortableTableHead className="w-24 py-4 px-6" align="right" {...sh("status")}>Status</SortableTableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((inv) => (
                  <TableRow key={inv.id} className="cursor-pointer">
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
                        status={statuses[inv.id] ?? inv.status}
                        onStatusChange={(s) => handleStatusChange(inv.id, s)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden flex-1 overflow-y-auto">
        {invoices.length === 0 ? (
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
              <Card key={inv.id} className="py-0">
                <CardContent className="p-0">
                  <InvoiceCard invoice={inv} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
