"use client";

import { INVOICES, ENTRIES } from "@/lib/mock-data";
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
import { PageHeader } from "@/components/page-header";
import { FileText, Plus, Search } from "lucide-react";

function uninvoicedGroupCount(): number {
  const uninvoiced = ENTRIES.filter((e) => !e.invoice_id);
  const groups = new Set(uninvoiced.map((e) => `${e.client.id}-${e.iso_week}`));
  return groups.size;
}

const uniqueClients = Array.from(
  new Map(INVOICES.map((inv) => [inv.client.id, inv.client])).values()
);

function InvoiceCard({ invoice }: { invoice: (typeof INVOICES)[number] }) {
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
        <Badge variant={invoice.status === "paid" ? "secondary" : "outline"}>
          {invoice.status}
        </Badge>
      </div>
    </div>
  );
}

export default function InvoicesPage() {
  const uninvoicedCount = uninvoicedGroupCount();

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
        <div className="px-4 md:px-6 py-6 flex flex-col gap-4 flex-1">
          <div className="rounded-lg border bg-card">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b">
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
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24 py-4 px-6">Number</TableHead>
                  <TableHead className="py-4 px-6">Client</TableHead>
                  <TableHead className="w-28 py-4 px-6">Dates</TableHead>
                  <TableHead className="w-28 py-4 px-6">Issued</TableHead>
                  <TableHead className="w-28 text-right py-4 px-6">Total</TableHead>
                  <TableHead className="w-20 text-center py-4 px-6">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {INVOICES.map((inv) => (
                  <TableRow key={inv.id} className="cursor-pointer">
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
                    <TableCell className="text-sm text-muted-foreground py-4 px-6">
                      {inv.date_range}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground py-4 px-6">
                      {formatDateShort(inv.issued_date)}
                    </TableCell>
                    <TableCell className="text-sm text-right tabular-nums py-4 px-6">
                      {formatAUD(inv.total)}
                    </TableCell>
                    <TableCell className="text-center py-4 px-6">
                      <Badge variant={inv.status === "paid" ? "secondary" : "outline"}>
                        {inv.status}
                      </Badge>
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
        {INVOICES.length === 0 ? (
          <Empty className="h-64">
            <EmptyHeader>
              <EmptyMedia variant="icon"><FileText /></EmptyMedia>
              <EmptyTitle>No invoices yet</EmptyTitle>
              <EmptyDescription>Invoices you create will appear here.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="px-4 py-4 flex flex-col gap-3">
            {INVOICES.map((inv) => (
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
