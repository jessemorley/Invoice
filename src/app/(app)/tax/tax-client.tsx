"use client";

import { useState, useTransition } from "react";
import type { TaxFyTotals } from "@/lib/queries";
import { formatAUD, formatDateShort, fyLabel, fyStartYear } from "@/lib/format";
import { taxEstimate } from "@/lib/tax-estimate";
import { createPaygInstalment, deletePaygInstalment } from "@/app/(app)/tax/actions";
import { invalidate } from "@/lib/invalidate";
import { EXPENSE_CATEGORY_LABELS, EXPENSE_CATEGORY_COLORS } from "@/lib/mock-data";
import type { ExpenseCategory } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ClientSquircle } from "@/components/client-squircle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Trash2 } from "lucide-react";
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
          <Card>
            <CardHeader>
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-9 w-40 mt-1" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-12 w-full rounded-md" />
            </CardContent>
          </Card>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-7 w-24" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {[...Array(2)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-3 w-24" />
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  {[...Array(3)].map((_, j) => <Skeleton key={j} className="h-9 w-full rounded-md" />)}
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
  const [newDate, setNewDate] = useState(() => new Date().toLocaleDateString("en-CA"));
  const [newAmount, setNewAmount] = useState("");
  const [pending, startTransition] = useTransition();

  const addInstalment = () => {
    const amount = Number(newAmount);
    if (!newDate || !Number.isFinite(amount) || amount <= 0) return;
    startTransition(async () => {
      await createPaygInstalment({ paid_date: newDate, amount, label: null });
      invalidate("payg");
      setNewAmount("");
    });
  };

  const removeInstalment = (id: string) => {
    startTransition(async () => {
      await deletePaygInstalment(id);
      invalidate("payg");
    });
  };

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
  const paygInstalments = selectedTotals?.paygInstalments ?? [];
  const paygPaid = selectedTotals?.paygPaid ?? 0;
  const remainingTax = tax.total - paygPaid;

  // Single 100%-stacked bar: how net profit splits into gross profit + each tax component.
  const splitConfig = {
    afterTax: { label: "Gross profit", color: "var(--chart-1)" },
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

          {/* Tier 1 — Hero: net profit + split bar */}
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-2">
              <div>
                <CardDescription>Net profit</CardDescription>
                <CardTitle className="text-4xl tabular-nums">{formatAUD(net)}</CardTitle>
                <p className="text-xs text-muted-foreground pt-1">
                  Revenue {formatAUD(income)} − expenses {formatAUD(expenditure)}
                </p>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">{fyLabel(selected)}</span>
            </CardHeader>
            {afterTax > 0 && (
              <CardContent>
                <ChartContainer config={splitConfig} className="!aspect-auto h-12 w-full">
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
              </CardContent>
            )}
          </Card>

          {/* Tier 2 — Stat tiles. ponytail: plain bordered divs, not a StatTile component — 3 usages, one file */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1">
              <span className="text-sm text-muted-foreground">Estimated gross profit</span>
              <span className="text-2xl tabular-nums text-success">{formatAUD(afterTax)}</span>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1">
              <span className="text-sm text-muted-foreground">Estimated tax</span>
              <span className="text-2xl tabular-nums">{formatAUD(tax.total)}</span>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1">
              <span className="text-sm text-muted-foreground">
                {remainingTax > 0 ? "Estimated tax owing" : remainingTax < 0 ? "Estimated refund" : "Tax owing"}
              </span>
              <span className={cn("text-2xl tabular-nums", remainingTax > 0 && "text-destructive")}>
                {remainingTax === 0 && paygPaid > 0 ? "Fully paid" : formatAUD(Math.abs(remainingTax))}
              </span>
              {paygPaid > 0 && remainingTax !== 0 && (
                <span className="text-xs text-muted-foreground">{formatAUD(paygPaid)} PAYG paid</span>
              )}
            </div>
          </div>

          {/* Tier 3a — Revenue & expenses, side by side */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Revenue</CardTitle>
                <CardDescription className="tabular-nums">{formatAUD(income)}</CardDescription>
              </CardHeader>
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
                    <span className="text-sm text-muted-foreground">Other clients</span>
                    <span className="text-sm tabular-nums shrink-0 ml-2">{formatAUD(otherClientsIncome)}</span>
                  </div>
                )}
                {topClients.length === 0 && (
                  <p className="text-sm text-muted-foreground px-3 py-2">No revenue recorded.</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Expenses</CardTitle>
                <CardDescription className="tabular-nums">{formatAUD(expenditure)}</CardDescription>
              </CardHeader>
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
                    <span className="text-sm tabular-nums shrink-0 ml-2">−{formatAUD(amount)}</span>
                  </div>
                ))}
                {categoryBreakdown.length === 0 && (
                  <p className="text-sm text-muted-foreground px-3 py-2">No expenses recorded.</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Tier 3b — Tax estimate breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Tax estimate</CardTitle>
              <CardDescription className="tabular-nums">{formatAUD(tax.total)} total</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
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
              {paygPaid > 0 && (
                <div className="flex items-center justify-between py-2 px-3 rounded-lg border border-border">
                  <span className="text-sm text-muted-foreground">PAYG instalments paid</span>
                  <span className="text-sm tabular-nums shrink-0 ml-2">+{formatAUD(paygPaid)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tier 4 — PAYG instalments (data entry, demoted) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">PAYG instalments</CardTitle>
              <CardDescription>
                {paygInstalments.length === 0
                  ? "None recorded"
                  : `${formatAUD(paygPaid)} paid across ${paygInstalments.length} instalment${paygInstalments.length === 1 ? "" : "s"}`}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
                {paygInstalments.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between py-2 px-3 rounded-lg border border-border"
                  >
                    <span className="text-sm text-muted-foreground">{formatDateShort(p.paid_date)}</span>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-sm tabular-nums">{formatAUD(p.amount)}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground hover:text-destructive"
                        disabled={pending}
                        onClick={() => removeInstalment(p.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <div className="flex items-center gap-2 pt-1">
                  <Input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-auto"
                  />
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    placeholder="Amount"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") addInstalment(); }}
                    className="flex-1"
                  />
                  <Button onClick={addInstalment} disabled={pending || !newAmount}>
                    {pending ? <Spinner className="size-4" /> : "Add"}
                  </Button>
                </div>
              </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}
