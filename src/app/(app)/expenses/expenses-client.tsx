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
import { Paperclip, Plus, Receipt, Search } from "lucide-react";

type SortKey = "date" | "category" | "amount";
type SortDir = "asc" | "desc";

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

function ExpenseCard({ expense }: { expense: Expense }) {
  const gst = gstAmount(expense);
  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors cursor-pointer">
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

export function ExpensesClient({ expenses }: { expenses: Expense[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sorted = [...expenses].sort((a, b) => {
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
        <Button size="sm" className="hidden md:flex">
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
              <Input placeholder="Search expenses..." className="pl-8" />
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
            <Select defaultValue="all-categories">
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
                {sorted.map((exp) => (
                  <TableRow key={exp.id} className="cursor-pointer">
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
      <div className="md:hidden flex-1 overflow-y-auto">
        {expenses.length === 0 ? (
          <Empty className="h-64">
            <EmptyHeader>
              <EmptyMedia variant="icon"><Receipt /></EmptyMedia>
              <EmptyTitle>No expenses yet</EmptyTitle>
              <EmptyDescription>Expenses you add will appear here.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="px-4 py-4 flex flex-col gap-3">
            {expenses.map((exp) => (
              <Card key={exp.id} className="py-0">
                <CardContent className="p-0">
                  <ExpenseCard expense={exp} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="md:hidden fixed bottom-18 right-4 z-40">
        <Button size="icon" className="size-14 rounded-full shadow-lg">
          <Plus />
        </Button>
      </div>
    </div>
  );
}
