"use client";

import { useState } from "react";
import type { Client } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SortableTableHead } from "@/components/sortable-table-head";
import { PageHeader } from "@/components/page-header";
import { ClientSheet } from "@/components/client-sheet";
import { Search, Users } from "lucide-react";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";

const CLIENT_COLOR_FALLBACK = "#9ca3af";

const BILLING_LABEL: Record<string, string> = {
  day_rate: "Day rate",
  hourly: "Hourly",
  manual: "Manual",
};

type SortKey = "name" | "billing_type";

function ClientCard({ client, onClick }: { client: Client; onClick: () => void }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors cursor-pointer"
      onClick={onClick}
    >
      <div
        className="size-2.5 rounded-full shrink-0"
        style={{ backgroundColor: client.color ?? CLIENT_COLOR_FALLBACK }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{client.name}</p>
        <p className="text-xs text-muted-foreground">{client.email || client.contact_name || BILLING_LABEL[client.billing_type]}</p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="text-sm tabular-nums text-muted-foreground">{client.invoice_count} inv</span>
        {!client.is_active && (
          <span className="text-xs text-muted-foreground">Inactive</span>
        )}
      </div>
    </div>
  );
}

export function ClientsView({ clients: allClients }: { clients: Client[] }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [searchValue, setSearchValue] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function openClient(client: Client) {
    setSelectedClient(client);
    setSheetOpen(true);
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function sh(key: SortKey) {
    return {
      active: sortKey === key,
      dir: sortDir,
      onSort: () => handleSort(key),
    };
  }

  const clients = allClients
    .filter((c) => {
      if (searchValue && !c.name.toLowerCase().includes(searchValue.toLowerCase())) return false;
if (statusFilter === "active" && !c.is_active) return false;
      if (statusFilter === "inactive" && c.is_active) return false;
      return true;
    })
    .sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortKey === "name") return a.name.localeCompare(b.name) * dir;
      if (sortKey === "billing_type") return a.billing_type.localeCompare(b.billing_type) * dir;
      return 0;
    });

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Clients" />

      {/* Desktop table */}
      <div className="hidden md:flex flex-col flex-1 overflow-y-auto">
        <div className="px-4 md:px-6 py-6 mx-auto w-full max-w-6xl flex flex-col gap-4 flex-1">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search clients..."
                className="pl-8"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
              />
            </div>
<Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead className="py-4 px-6" {...sh("name")}>Name</SortableTableHead>
                  <TableHead className="w-48 py-4 px-6">Contact</TableHead>
                  <SortableTableHead className="w-28 py-4 px-6" {...sh("billing_type")}>Billing</SortableTableHead>
                  <TableHead className="w-24 py-4 px-6 text-right">Invoices</TableHead>
                  <TableHead className="w-24 py-4 px-6 text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                      No clients match these filters.
                    </TableCell>
                  </TableRow>

                ) : (
                  clients.map((client) => (
                    <TableRow key={client.id} className="cursor-pointer" onClick={() => openClient(client)}>
                      <TableCell className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <div
                            className="size-2 rounded-full shrink-0"
                            style={{ backgroundColor: client.color ?? CLIENT_COLOR_FALLBACK }}
                          />
                          <span className="text-sm font-medium">{client.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4 px-6 text-sm text-muted-foreground truncate max-w-0">
                        {client.email || client.contact_name || "—"}
                      </TableCell>
                      <TableCell className="py-4 px-6">
                        <Badge variant="outline" className="text-xs font-normal">
                          {BILLING_LABEL[client.billing_type]}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4 px-6 text-sm text-right tabular-nums text-muted-foreground">
                        {client.invoice_count}
                      </TableCell>
                      <TableCell className="py-4 px-6 text-right">
                        <Badge variant={client.is_active ? "default" : "secondary"}>
                          {client.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden flex-1 overflow-y-auto">
        <div className="px-4 pt-4 pb-2 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              className="pl-8"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {clients.length === 0 ? (
          <Empty className="h-64">
            <EmptyHeader>
              <EmptyMedia variant="icon"><Users /></EmptyMedia>
              <EmptyTitle>No clients</EmptyTitle>
              <EmptyDescription>Clients you add will appear here.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="px-4 py-3 flex flex-col gap-3">
            {clients.map((client) => (
              <Card key={client.id} className="py-0">
                <CardContent className="p-0">
                  <ClientCard client={client} onClick={() => openClient(client)} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <ClientSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        client={selectedClient}
      />
    </div>
  );
}
