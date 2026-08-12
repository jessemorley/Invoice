"use client";

import { useState, useTransition } from "react";
import type { TaxFyTotals } from "@/lib/queries";
import { formatAUD, formatDateShort, fyLabel, fyStartYear, wfhFixedRate } from "@/lib/format";
import { taxEstimate } from "@/lib/tax-estimate";
import { createPaygInstalment, deletePaygInstalment, setWfhHours } from "@/app/(app)/tax/actions";
import { invalidate } from "@/lib/invalidate";
import { EXPENSE_CATEGORY_LABELS, EXPENSE_CATEGORY_COLORS, EXPENSE_POOL_LABELS } from "@/lib/mock-data";
import type { ExpenseCategory } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ClientSquircle } from "@/components/client-squircle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Trash2, BarChart2, PieChart } from "lucide-react";
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
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

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
            <CardContent className="flex flex-col gap-4">
              <Skeleton className="h-48 w-full rounded-md" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="rounded-xl border border-border p-4 flex flex-col gap-2">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-7 w-24" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
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
  const [chartMode, setChartMode] = useState<"monthly" | "split">("monthly");
  // null = untouched → input shows saved hours, or the weekdays-without-entries seed.
  const [wfhDraft, setWfhDraft] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const addInstalment = () => {
    const amount = Number(newAmount);
    if (!newDate || !Number.isFinite(amount) || amount <= 0) return;
    startTransition(async () => {
      try {
        await createPaygInstalment({ paid_date: newDate, amount, label: null });
        invalidate("payg");
        setNewAmount("");
      } catch (err) {
        // startTransition swallows rejections — without this the button silently no-ops.
        console.error("createPaygInstalment failed", err);
      }
    });
  };

  const removeInstalment = (id: string) => {
    startTransition(async () => {
      try {
        await deletePaygInstalment(id);
        invalidate("payg");
      } catch (err) {
        console.error("deletePaygInstalment failed", err);
      }
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
  // WFH fixed-rate deduction reduces taxable income alongside expenses.
  const wfhHours = selectedTotals?.wfhHours ?? 0;
  const wfhRate = wfhFixedRate(selected);
  // Calculated seed: weekdays with no entry logged × 8h/day, used until a value is saved.
  const weekdaysWithoutEntries = selectedTotals?.weekdaysWithoutEntries ?? 0;
  const wfhSeedHours = weekdaysWithoutEntries * 8;
  const wfhValue = wfhDraft ?? String(wfhHours || wfhSeedHours || "");
  const wfhParsed = wfhValue.trim() === "" ? 0 : Number(wfhValue);
  const wfhValid = Number.isFinite(wfhParsed) && wfhParsed >= 0;
  const wfhSaveable = wfhValid && wfhParsed !== wfhHours;
  // Tax-view-only deduction: joins the expense totals here but is never a stored
  // expense row. Uses saved hours only — the input applies on Add/Update.
  const wfhDeduction = wfhRate ? wfhHours * wfhRate : 0;
  const saveWfhHours = () => {
    if (!wfhSaveable) return;
    startTransition(async () => {
      await setWfhHours(selected, wfhParsed);
      invalidate("payg");
      setWfhDraft(null);
    });
  };
  const totalExpenses = expenditure + wfhDeduction;
  const net = income - totalExpenses;
  const tax = taxEstimate(net);
  const afterTax = net - tax.total;
  const paygInstalments = selectedTotals?.paygInstalments ?? [];
  const paygPaid = selectedTotals?.paygPaid ?? 0;
  const remainingTax = tax.total - paygPaid;

  // 12-month revenue vs expenses bars (FY order: Jul→Jun).
  const monthlyConfig = {
    revenue: { label: "Revenue", color: "var(--color-primary)" },
    expenses: { label: "Expenses", color: "var(--color-muted-foreground)" },
  } satisfies ChartConfig;
  const monthly = selectedTotals?.monthly ?? [];
  const hasMonthlyData = monthly.some((m) => m.revenue > 0 || m.expenses > 0);

  // 100%-stacked bar: how net profit splits into gross profit + each tax component.
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
  const pools = (["depreciation", "other"] as const)
    .map((pool) => {
      const categories = Object.entries(selectedTotals?.expenditureByPool?.[pool] ?? {});
      // WFH fixed-rate deduction joins the immediate-deduction pool, tax view only.
      if (pool === "other" && wfhDeduction > 0) categories.push(["wfh", wfhDeduction]);
      categories.sort(([, a], [, b]) => b - a);
      return { pool, categories, total: categories.reduce((sum, [, amt]) => sum + amt, 0) };
    })
    .filter((p) => p.categories.length > 0);
  const categoryLabel = (c: string) => (c === "wfh" ? "Working from home" : EXPENSE_CATEGORY_LABELS[c as ExpenseCategory]);
  const categoryColor = (c: string) => (c === "wfh" ? "#64748b" : EXPENSE_CATEGORY_COLORS[c as ExpenseCategory]);

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Tax" />
      <div className="flex-1 overflow-y-auto pb-28 md:pb-0">
        <div className="px-4 md:px-6 py-6 mx-auto w-full max-w-6xl flex flex-col gap-4">
          <Select value={String(selected)} onValueChange={(v) => { setSelected(Number(v)); setWfhDraft(null); }}>
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

          {/* Tier 1 — Hero: net profit + toggleable chart (monthly bars / profit-tax split) */}
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-2">
              <div>
                <CardDescription>Net profit</CardDescription>
                <CardTitle className="text-4xl tabular-nums">{formatAUD(net)}</CardTitle>
                <p className="text-xs text-muted-foreground pt-1">
                  Revenue {formatAUD(income)} − expenses {formatAUD(totalExpenses)}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-muted-foreground">{fyLabel(selected)}</span>
                <div className="flex rounded-md border overflow-hidden">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Monthly revenue & expenses"
                    className={cn("h-7 w-7 rounded-none", chartMode === "monthly" && "bg-muted")}
                    onClick={() => setChartMode("monthly")}
                  >
                    <BarChart2 className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Profit & tax split"
                    className={cn("h-7 w-7 rounded-none border-l", chartMode === "split" && "bg-muted")}
                    onClick={() => setChartMode("split")}
                  >
                    <PieChart className="size-3.5" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {chartMode === "monthly" && hasMonthlyData && (
                <ChartContainer config={monthlyConfig} className="h-48 w-full">
                  <BarChart data={monthly} barCategoryGap="20%">
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value, name) => (
                            <>
                              <span className="text-muted-foreground">{monthlyConfig[name as keyof typeof monthlyConfig]?.label ?? name}</span>
                              <span className="font-mono font-medium tabular-nums ml-auto pl-4">{formatAUD(Number(value))}</span>
                            </>
                          )}
                        />
                      }
                    />
                    <Bar dataKey="revenue" fill="var(--color-primary)" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="expenses" fill="var(--color-muted-foreground)" fillOpacity={0.4} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              )}
              {chartMode === "split" && afterTax > 0 && (
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
              )}

              {/* Stat tiles. ponytail: plain bordered divs, not a StatTile component — 3 usages, one file */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-xl border border-border p-4 flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Estimated gross profit</span>
                  <span className="text-2xl tabular-nums text-success">{formatAUD(afterTax)}</span>
                </div>
                <div className="rounded-xl border border-border p-4 flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Estimated tax</span>
                  <span className="text-2xl tabular-nums">{formatAUD(tax.total)}</span>
                  <dl className="text-xs text-muted-foreground flex flex-col gap-0.5 pt-1">
                    <div className="flex justify-between gap-2">
                      <dt>Income tax</dt>
                      <dd className="tabular-nums">{formatAUD(tax.incomeTax)}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt>Medicare levy</dt>
                      <dd className="tabular-nums">{formatAUD(tax.medicareLevy)}</dd>
                    </div>
                    {tax.hecs > 0 && (
                      <div className="flex justify-between gap-2">
                        <dt>HECS/HELP</dt>
                        <dd className="tabular-nums">{formatAUD(tax.hecs)}</dd>
                      </div>
                    )}
                  </dl>
                </div>
                <div className="rounded-xl border border-border p-4 flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">
                    {remainingTax > 0 ? "Estimated tax owing" : remainingTax < 0 ? "Estimated refund" : "Tax owing"}
                  </span>
                  <span className={cn("text-2xl tabular-nums", remainingTax > 0 && "text-destructive")}>
                    {remainingTax === 0 && paygPaid > 0
                      ? "Fully paid"
                      : `${remainingTax > 0 ? "−" : remainingTax < 0 ? "+" : ""}${formatAUD(Math.abs(remainingTax))}`}
                  </span>
                  {paygPaid > 0 && remainingTax !== 0 && (
                    <span className="text-xs text-muted-foreground">{formatAUD(paygPaid)} PAYG paid</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

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
                <CardDescription className="tabular-nums">{formatAUD(totalExpenses)}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {pools.map(({ pool, categories, total }) => (
                  <div key={pool} className="flex flex-col gap-2">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-xs font-medium text-muted-foreground">
                        {EXPENSE_POOL_LABELS[pool]}
                      </span>
                      <span className="text-xs tabular-nums text-muted-foreground shrink-0 ml-2">
                        −{formatAUD(total)}
                      </span>
                    </div>
                    {categories.map(([category, amount]) => (
                      <div
                        key={category}
                        className="flex items-center justify-between py-2 px-3 rounded-lg border border-border"
                      >
                        <span
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                          style={{
                            backgroundColor: `${categoryColor(category)}22`,
                            color: categoryColor(category),
                          }}
                        >
                          {categoryLabel(category)}
                        </span>
                        <span className="text-sm tabular-nums shrink-0 ml-2">−{formatAUD(amount)}</span>
                      </div>
                    ))}
                  </div>
                ))}
                {pools.length === 0 && (
                  <p className="text-sm text-muted-foreground px-3 py-2">No expenses recorded.</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Tier 3a2 — Working from home (ATO fixed-rate method) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Working from home</CardTitle>
              <CardDescription className="tabular-nums">
                {wfhRate
                  ? `${formatAUD(wfhDeduction)} deduction — fixed rate ${Math.round(wfhRate * 100)}c/hr`
                  : `No fixed rate applies to ${fyLabel(selected)}`}
              </CardDescription>
            </CardHeader>
            {wfhRate && (
              <CardContent className="flex flex-col gap-2">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
                  <label htmlFor="wfh-hours" className="text-sm text-muted-foreground">
                    Hours worked from home
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="wfh-hours"
                      type="number"
                      min={0}
                      step="0.5"
                      inputMode="decimal"
                      value={wfhValue}
                      onChange={(e) => setWfhDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") saveWfhHours(); }}
                      placeholder="0"
                      disabled={pending}
                      className="flex-1 sm:flex-none sm:w-28 min-w-0 text-right tabular-nums"
                    />
                    <Button
                      variant="outline"
                      className="shrink-0"
                      onClick={() => setWfhDraft(String(wfhSeedHours))}
                      disabled={pending || wfhParsed === wfhSeedHours}
                    >
                      Calculate
                    </Button>
                    <Button className="shrink-0" onClick={saveWfhHours} disabled={pending || !wfhSaveable}>
                      {pending ? <Spinner className="size-4" /> : wfhHours > 0 ? "Update" : "Add"}
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {weekdaysWithoutEntries > 0 &&
                    `Calculate fills ${weekdaysWithoutEntries} weekdays with no entry logged × 8 h = ${wfhSeedHours} h. `}
                  Covers electricity, gas, internet, phone and stationery.
                </p>
              </CardContent>
            )}
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
                    // Typing emits "" until all 3 segments are complete — only commit
                    // real values, or a half-typed date would wipe the committed one.
                    value={newDate}
                    onChange={(e) => { if (e.target.value) setNewDate(e.target.value); }}
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
                  <Button onClick={addInstalment} disabled={pending || !newAmount || !newDate}>
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
