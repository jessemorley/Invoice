"use client";

import { useState } from "react";
import type { Expense, ExpenseCategory } from "@/lib/types";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/mock-data";
import { formatAUD, formatDateShort } from "@/lib/format";
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
import { SortableTableHead } from "@/components/sortable-table-head";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { ExpenseSheet } from "@/components/expense-sheet";
import { Paperclip, Plus, Receipt, Search } from "lucide-react";

type SortKey = "date" | "category" | "amount";
type SortDir = "asc" | "desc";
type Timeframe = "all-time" | "this-week" | "this-month" | "last-month" | "this-year";

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  gear:            "#6366f1",
  gear_consumable: "#818cf8",
  gear_hire:       "#f97316",
  lab:             "#06b6d4",
  education:       "#8b5cf6",
  software:        "#10b981",
  travel:          "#f59e0b",
  other:           "#94a3b8",
  office:          "#64748b",
};

function gstAmount(expense: Expense): string | null {
  if (!expense.gst_included) return null;
  return formatAUD(expense.amount / 11);
}

function ReceiptChip({ path }: { path: string }) {
  const name = path.split("/").pop();
  return (
    <>
      <span className="hidden xl:inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs text-muted-foreground font-normal max-w-full">
        <Paperclip className="size-3 shrink-0" />
        <span className="truncate">{name}</span>
      </span>
      <span className="xl:hidden inline-flex items-center justify-center rounded-md border p-1 text-muted-foreground" title={name}>
        <Paperclip className="size-3" />
      </span>
    </>
  );
}

function inTimeframe(date: string, timeframe: Timeframe): boolean {
  if (timeframe === "all-time") return true;
  const d = new Date(date + "T00:00:00");
  const now = new Date();
  if (timeframe === "this-week") {
    const day = now.getDay();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - ((day + 6) % 7));
    weekStart.setHours(0, 0, 0, 0);
    return d >= weekStart;
  }
  if (timeframe === "this-month") {
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }
  if (timeframe === "last-month") {
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return d.getMonth() === lastMonth.getMonth() && d.getFullYear() === lastMonth.getFullYear();
  }
  if (timeframe === "this-year") {
    return d.getFullYear() === now.getFullYear();
  }
  return true;
}

function ExpenseCard({ expense, onClick }: { expense: Expense; onClick: () => void }) {
  const gst = gstAmount(expense);
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors cursor-pointer"
      onClick={onClick}
    >
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-foreground truncate block">
          {expense.description}
        </span>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-xs text-muted-foreground">
            {formatDateShort(expense.date)}
          </span>
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
            style={{
              backgroundColor: `${CATEGORY_COLORS[expense.category]}22`,
              color: CATEGORY_COLORS[expense.category],
            }}
          >
            {EXPENSE_CATEGORY_LABELS[expense.category]}
          </span>
          {expense.receipt_path && (
            <ReceiptChip path={expense.receipt_path} />
          )}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="text-sm tabular-nums text-foreground">
          {formatAUD(expense.amount)}
        </span>
        {gst && (
          <span className="text-xs tabular-nums text-muted-foreground">GST {gst}</span>
        )}
      </div>
    </div>
  );
}

function ExpensesSkeleton() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Expenses" />
      {/* Desktop */}
      <div className="hidden md:flex flex-col flex-1 overflow-y-auto">
        <div className="px-4 md:px-6 py-6 mx-auto w-full max-w-6xl flex flex-col gap-4 flex-1">
          <div className="flex gap-3">
            <Skeleton className="h-9 flex-1" />
            <Skeleton className="h-9 w-36" />
            <Skeleton className="h-9 w-36" />
          </div>
          <div className="rounded-lg border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28 py-4 px-6">Date</TableHead>
                  <TableHead className="w-24 py-4 px-6">Category</TableHead>
                  <TableHead className="py-4 px-6">Description</TableHead>
                  <TableHead className="py-4 px-6">Receipt</TableHead>
                  <TableHead className="w-28 py-4 px-6 text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...Array(7)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell className="py-4 px-6"><Skeleton className="h-3 w-16" /></TableCell>
                    <TableCell className="py-4 px-6"><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                    <TableCell className="py-4 px-6"><Skeleton className="h-3 w-48" /></TableCell>
                    <TableCell className="py-4 px-6"><Skeleton className="h-3 w-10" /></TableCell>
                    <TableCell className="py-4 px-6 text-right"><Skeleton className="h-3 w-16 ml-auto" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
      {/* Mobile */}
      <div className="md:hidden flex-1 overflow-y-auto pb-28">
        <div className="px-4 py-4 flex flex-col gap-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="py-0">
              <CardContent className="px-4 py-3 flex items-center gap-3">
                <div className="flex-1 flex flex-col gap-1.5">
                  <div className="flex justify-between">
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <div className="flex justify-between">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-3 w-10" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ExpensesClient({ expenses, loading = false }: { expenses: Expense[]; loading?: boolean }) {
  if (loading) return <ExpensesSkeleton />;
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [search, setSearch] = useState("");
  const [timeframe, setTimeframe] = useState<Timeframe>("all-time");
  const [category, setCategory] = useState<ExpenseCategory | "all-categories">("all-categories");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selected, setSelected] = useState<Expense | null>(null);

  function openNew() {
    setSelected(null);
    setSheetOpen(true);
  }

  function openEdit(exp: Expense) {
    setSelected(exp);
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

  const filtered = expenses.filter((exp) => {
    if (search && !exp.description.toLowerCase().includes(search.toLowerCase())) return false;
    if (!inTimeframe(exp.date, timeframe)) return false;
    if (category !== "all-categories" && exp.category !== category) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case "date":     cmp = a.date.localeCompare(b.date); break;
      case "category": cmp = a.category.localeCompare(b.category); break;
      case "amount":   cmp = a.amount - b.amount; break;
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  function sh(key: SortKey) {
    return { active: sortKey === key, dir: sortDir, onSort: () => handleSort(key) };
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Expenses">
        <Button size="sm" className="hidden md:flex" onClick={openNew}>
          <Plus className="size-4" />
          New expense
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
                placeholder="Search expenses..."
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={timeframe} onValueChange={(v) => setTimeframe(v as Timeframe)}>
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
            <Select value={category} onValueChange={(v) => setCategory(v as ExpenseCategory | "all-categories")}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all-categories">All categories</SelectItem>
                {(Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[]).map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {EXPENSE_CATEGORY_LABELS[cat]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead className="w-28 py-4 px-6" {...sh("date")}>Date</SortableTableHead>
                  <SortableTableHead className="w-24 py-4 px-6" {...sh("category")}>Category</SortableTableHead>
                  <TableHead className="py-4 px-6">Description</TableHead>
                  <TableHead className="py-4 px-6">Receipt</TableHead>
                  <SortableTableHead className="w-28 py-4 px-6" align="right" {...sh("amount")}>Amount</SortableTableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-12 text-sm">
                      No expenses found
                    </TableCell>
                  </TableRow>
                ) : sorted.map((exp) => (
                  <TableRow key={exp.id} className="cursor-pointer" onClick={() => openEdit(exp)}>
                    <TableCell className="text-sm text-muted-foreground py-4 px-6">
                      {formatDateShort(exp.date)}
                    </TableCell>
                    <TableCell className="py-4 px-6">
                      <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{
                          backgroundColor: `${CATEGORY_COLORS[exp.category]}22`,
                          color: CATEGORY_COLORS[exp.category],
                        }}
                      >
                        {EXPENSE_CATEGORY_LABELS[exp.category]}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm py-4 px-6">
                      <div>
                        <span>{exp.description}</span>
                        {exp.notes && (
                          <p className="text-xs text-muted-foreground truncate max-w-sm mt-0.5">{exp.notes}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-4 px-6">
                      {exp.receipt_path && <ReceiptChip path={exp.receipt_path} />}
                    </TableCell>
                    <TableCell className="text-sm text-right tabular-nums py-4 px-6">
                      {formatAUD(exp.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden flex-1 overflow-y-auto pb-28">
        {expenses.length === 0 ? (
          <Empty className="h-64">
            <EmptyHeader>
              <EmptyMedia variant="icon"><Receipt /></EmptyMedia>
              <EmptyTitle>No expenses yet</EmptyTitle>
              <EmptyDescription>Expenses you add will appear here.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : sorted.length === 0 ? (
          <Empty className="h-64">
            <EmptyHeader>
              <EmptyMedia variant="icon"><Receipt /></EmptyMedia>
              <EmptyTitle>No expenses found</EmptyTitle>
              <EmptyDescription>Try adjusting your filters.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="px-4 py-4 flex flex-col gap-3">
            {sorted.map((exp) => (
              <Card key={exp.id} className="py-0">
                <CardContent className="p-0">
                  <ExpenseCard expense={exp} onClick={() => openEdit(exp)} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="md:hidden fixed bottom-18 right-4 z-40">
        <Button size="icon" className="size-14 rounded-full shadow-lg" onClick={openNew}>
          <Plus />
        </Button>
      </div>

      <ExpenseSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        expense={selected}
      />
    </div>
  );
}
