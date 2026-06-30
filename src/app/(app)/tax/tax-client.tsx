"use client";

import { useState } from "react";
import type { TaxFyTotals } from "@/lib/queries";
import { formatAUD, fyLabel, fyStartYear } from "@/lib/format";
import { EXPENSE_CATEGORY_LABELS, EXPENSE_CATEGORY_COLORS } from "@/lib/mock-data";
import type { ExpenseCategory } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ClientSquircle } from "@/components/client-squircle";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function TaxSkeleton() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Tax" />
      <div className="flex-1 overflow-y-auto pb-28 md:pb-0">
        <div className="px-4 md:px-6 py-6 mx-auto w-full max-w-6xl flex flex-col gap-4">
          <Skeleton className="h-9 w-32" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-8 w-32 mt-1" />
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  {[...Array(2)].map((_, j) => <Skeleton key={j} className="h-9 w-full rounded-md" />)}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function TaxClient({ fyTotals }: { fyTotals?: TaxFyTotals[] }) {
  const currentStartYear = fyStartYear(new Date());
  const [selected, setSelected] = useState(currentStartYear);

  if (!fyTotals) return <TaxSkeleton />;

  // FYs with data, plus the current FY even if it has no entries yet
  const startYears = Array.from(new Set([currentStartYear, ...fyTotals.map((f) => f.startYear)])).sort(
    (a, b) => b - a
  );
  const selectedTotals = fyTotals.find((f) => f.startYear === selected);
  const income = selectedTotals?.income ?? 0;
  const expenditure = selectedTotals?.expenditure ?? 0;
  const net = income - expenditure;
  const incomeByClient = selectedTotals?.incomeByClient ?? [];
  const categoryBreakdown = Object.entries(selectedTotals?.expenditureByCategory ?? {}).sort(
    ([, a], [, b]) => b - a
  );

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Tax" />
      <div className="flex-1 overflow-y-auto pb-28 md:pb-0">
        <div className="px-4 md:px-6 py-6 mx-auto w-full max-w-6xl flex flex-col gap-4">
          <Select value={String(selected)} onValueChange={(v) => setSelected(Number(v))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {startYears.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {fyLabel(y)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardDescription>Gross income</CardDescription>
                <CardTitle className="text-3xl tabular-nums">{formatAUD(income)}</CardTitle>
              </CardHeader>
              {incomeByClient.length > 0 && (
                <CardContent className="flex flex-col gap-2">
                  {incomeByClient.map(({ client, income: clientIncome }) => (
                    <div
                      key={client.id}
                      className="flex items-center justify-between py-2 px-3 rounded-lg border border-border"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <ClientSquircle name={client.name} color={client.color} className="size-[22px] shrink-0" />
                        <span className="text-sm text-muted-foreground truncate">{client.name}</span>
                      </div>
                      <span className="text-sm tabular-nums shrink-0 ml-2">{formatAUD(clientIncome)}</span>
                    </div>
                  ))}
                </CardContent>
              )}
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Expenditure</CardDescription>
                <CardTitle className="text-3xl tabular-nums">{formatAUD(expenditure)}</CardTitle>
              </CardHeader>
              {categoryBreakdown.length > 0 && (
                <CardContent className="flex flex-col gap-2">
                  {categoryBreakdown.map(([category, amount]) => (
                    <div
                      key={category}
                      className="flex items-center justify-between py-2 px-3 rounded-lg border border-border"
                    >
                      <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{
                          backgroundColor: `${EXPENSE_CATEGORY_COLORS[category as ExpenseCategory]}22`,
                          color: EXPENSE_CATEGORY_COLORS[category as ExpenseCategory],
                        }}
                      >
                        {EXPENSE_CATEGORY_LABELS[category as ExpenseCategory]}
                      </span>
                      <span className="text-sm tabular-nums shrink-0 ml-2">{formatAUD(amount)}</span>
                    </div>
                  ))}
                </CardContent>
              )}
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Net</CardDescription>
                <CardTitle className="text-3xl tabular-nums">{formatAUD(net)}</CardTitle>
              </CardHeader>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
