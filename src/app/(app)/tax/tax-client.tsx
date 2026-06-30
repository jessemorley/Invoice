"use client";

import { useState } from "react";
import type { TaxFyTotals } from "@/lib/queries";
import { formatAUD, fyLabel, fyStartYear } from "@/lib/format";
import { taxEstimate } from "@/lib/tax-estimate";
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
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { ChartConfig } from "@/components/ui/chart";
import { Bar, BarChart, XAxis, YAxis } from "recharts";

function TaxSkeleton() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Tax" />
      <div className="flex-1 overflow-y-auto pb-28 md:pb-0">
        <div className="px-4 md:px-6 py-6 mx-auto w-full max-w-6xl flex flex-col gap-4">
          <Skeleton className="h-9 w-32" />
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
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
  const tax = taxEstimate(net);
  const afterTax = net - tax.total;

  // Single 100%-stacked bar: how net splits into take-home + each tax component.
  const splitConfig = {
    afterTax: { label: "Take-home", color: "var(--chart-1)" },
    incomeTax: { label: "Income tax", color: "var(--chart-3)" },
    medicareLevy: { label: "Medicare levy", color: "var(--chart-4)" },
    hecs: { label: "HECS/HELP", color: "var(--chart-5)" },
  } satisfies ChartConfig;
  const splitData = [{ row: "split", afterTax, incomeTax: tax.incomeTax, medicareLevy: tax.medicareLevy, hecs: tax.hecs }];
  // Only the non-zero segments, so the last one can carry the rounded right edge.
  const splitKeys = (["afterTax", "incomeTax", "medicareLevy", "hecs"] as const).filter(
    (k) => splitData[0][k] > 0
  );
  const incomeByClient = selectedTotals?.incomeByClient ?? [];
  const topClients = incomeByClient.slice(0, 4);
  const otherClientsIncome = incomeByClient.slice(4).reduce((sum, c) => sum + c.income, 0);
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

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardDescription>Gross income</CardDescription>
                <CardTitle className="text-3xl tabular-nums">{formatAUD(income)}</CardTitle>
              </CardHeader>
              {incomeByClient.length > 0 && (
                <CardContent className="flex flex-col gap-2">
                  {topClients.map(({ client, income: clientIncome }) => (
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
                  {otherClientsIncome > 0 && (
                    <div className="flex items-center justify-between py-2 px-3 rounded-lg border border-border">
                      <span className="text-sm text-muted-foreground">Other</span>
                      <span className="text-sm tabular-nums shrink-0 ml-2">{formatAUD(otherClientsIncome)}</span>
                    </div>
                  )}
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
            <Card className="xl:col-span-2">
              <CardHeader>
                <CardDescription>Estimated after-tax</CardDescription>
                <CardTitle className="text-3xl tabular-nums">{formatAUD(afterTax)}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {afterTax > 0 && (
                  <ChartContainer config={splitConfig} className="!aspect-auto h-12 w-full mb-2">
                    <BarChart accessibilityLayer data={splitData} layout="vertical" stackOffset="expand" margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="row" hide />
                      <ChartTooltip
                        cursor={false}
                        shared={false}
                        content={
                          <ChartTooltipContent
                            hideLabel
                            formatter={(value, name) => (
                              <div className="flex flex-1 items-center justify-between gap-3">
                                <span className="text-muted-foreground">
                                  {splitConfig[name as keyof typeof splitConfig]?.label ?? name}
                                </span>
                                <span className="font-mono font-medium tabular-nums">{formatAUD(Number(value))}</span>
                              </div>
                            )}
                          />
                        }
                      />
                      {splitKeys.map((key, i) => (
                        <Bar
                          key={key}
                          dataKey={key}
                          stackId="a"
                          fill={`var(--color-${key})`}
                          radius={[
                            i === 0 ? 4 : 0,
                            i === splitKeys.length - 1 ? 4 : 0,
                            i === splitKeys.length - 1 ? 4 : 0,
                            i === 0 ? 4 : 0,
                          ]}
                        />
                      ))}
                    </BarChart>
                  </ChartContainer>
                )}
                <div className="flex items-center justify-between py-2 px-3 rounded-lg border border-border">
                  <span className="text-sm text-muted-foreground">Net (income − expenditure)</span>
                  <span className="text-sm tabular-nums shrink-0 ml-2">{formatAUD(net)}</span>
                </div>
                <div className="flex items-center justify-between py-2 px-3 rounded-lg border border-border">
                  <span className="text-sm text-muted-foreground">Income tax</span>
                  <span className="text-sm tabular-nums shrink-0 ml-2">−{formatAUD(tax.incomeTax)}</span>
                </div>
                <div className="flex items-center justify-between py-2 px-3 rounded-lg border border-border">
                  <span className="text-sm text-muted-foreground">Medicare levy</span>
                  <span className="text-sm tabular-nums shrink-0 ml-2">−{formatAUD(tax.medicareLevy)}</span>
                </div>
                {tax.hecs > 0 && (
                  <div className="flex items-center justify-between py-2 px-3 rounded-lg border border-border">
                    <span className="text-sm text-muted-foreground">HECS/HELP</span>
                    <span className="text-sm tabular-nums shrink-0 ml-2">−{formatAUD(tax.hecs)}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
