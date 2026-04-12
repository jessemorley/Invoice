"use client";

import { DASHBOARD, EXPENSES, EXPENSE_CATEGORY_LABELS, type ExpenseCategory } from "@/lib/mock-data";
import { formatAUD } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { TrendingDown, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Area, AreaChart, XAxis, YAxis, RadarChart, Radar, PolarGrid, PolarAngleAxis } from "recharts";

const chartConfig = {
  current: { label: "FY 25–26", color: "var(--color-primary)" },
  prior: { label: "FY 24–25", color: "var(--color-muted-foreground)" },
};

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  gear: "#6366f1",
  gear_hire: "#f97316",
  software: "#10b981",
  office: "#94a3b8",
};

const expenseCategoryTotals = (Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[]).map(
  (cat) => ({
    category: EXPENSE_CATEGORY_LABELS[cat],
    amount: EXPENSES.filter((e) => e.category === cat).reduce((sum, e) => sum + e.amount, 0),
    fill: CATEGORY_COLORS[cat],
  })
);

const radarChartConfig = {
  amount: { label: "Amount", color: "var(--color-primary)" },
} satisfies import("@/components/ui/chart").ChartConfig;

const expenseDates = EXPENSES.map((e) => e.date).sort();
const expenseDateRange = (() => {
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("en-AU", { month: "long", year: "numeric" });
  return `${fmt(expenseDates[0])} – ${fmt(expenseDates[expenseDates.length - 1])}`;
})();

const totalExpenses = expenseCategoryTotals.reduce((s, e) => s + e.amount, 0);
const topCategory = expenseCategoryTotals.reduce((a, b) => (b.amount > a.amount ? b : a));
const topCategoryPct = Math.round((topCategory.amount / totalExpenses) * 100);

export default function DashboardPage() {
  const { mtdEarnings, mtdPriorMonth, outstanding, monthlyEarnings } = DASHBOARD;
  const delta = mtdEarnings - mtdPriorMonth;
  const deltaPercent = ((delta / mtdPriorMonth) * 100).toFixed(0);
  const isUp = delta >= 0;

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Dashboard" />

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 md:px-6 py-6 grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* MTD Earnings */}
          <Card>
            <CardHeader>
              <CardDescription>Month to date — April</CardDescription>
              <CardTitle className="text-3xl tabular-nums">
                {formatAUD(mtdEarnings)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {isUp ? (
                  <TrendingUp className="size-3.5 text-success" />
                ) : (
                  <TrendingDown className="size-3.5 text-destructive" />
                )}
                <span className={cn("text-xs", isUp ? "text-success" : "text-destructive")}>
                  {isUp ? "+" : ""}{deltaPercent}% vs Mar
                </span>
                <span className="text-xs text-muted-foreground ml-1">
                  (Mar MTD: {formatAUD(mtdPriorMonth)})
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Outstanding invoices */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
              <CardDescription>
                {outstanding.length === 0
                  ? "All invoices paid"
                  : `${outstanding.length} unpaid invoices`}
              </CardDescription>
            </CardHeader>
            {outstanding.length > 0 && (
              <CardContent className="flex flex-col gap-2">
                {outstanding.map(({ invoice }) => (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between py-2 px-3 rounded-md border border-border hover:bg-accent/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="size-2 rounded-full"
                        style={{ backgroundColor: invoice.client.color }}
                      />
                      <span className="text-sm font-medium">{invoice.number}</span>
                      <span className="text-sm text-muted-foreground">{invoice.client.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm tabular-nums">{formatAUD(invoice.total)}</span>
                      <Badge variant="outline">{invoice.status}</Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            )}
          </Card>

          {/* 6-month earnings chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">6-month earnings</CardTitle>
              <CardDescription>
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-6 rounded-sm bg-primary" />
                    <span>FY 25–26</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-6 rounded-sm bg-muted-foreground/40" />
                    <span>FY 24–25</span>
                  </div>
                </div>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-48 w-full">
                <AreaChart data={monthlyEarnings}>
                  <defs>
                    <linearGradient id="gradCurrent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="gradPrior" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-muted-foreground)" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="var(--color-muted-foreground)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                    width={40}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    dataKey="prior"
                    type="monotone"
                    stroke="var(--color-muted-foreground)"
                    strokeWidth={1.5}
                    strokeOpacity={0.4}
                    fill="url(#gradPrior)"
                  />
                  <Area
                    dataKey="current"
                    type="monotone"
                    stroke="var(--color-primary)"
                    strokeWidth={2}
                    fill="url(#gradCurrent)"
                  />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>
          {/* Expense categories radar chart */}
          <Card>
            <CardHeader className="items-center pb-4">
              <CardTitle className="text-sm font-medium">Expenses by category</CardTitle>
              <CardDescription>{expenseDateRange}</CardDescription>
            </CardHeader>
            <CardContent className="pb-0">
              <ChartContainer config={radarChartConfig} className="h-[280px] w-full">
                <RadarChart data={expenseCategoryTotals}>
                  <ChartTooltip
                    cursor={false}
                    content={
                      <ChartTooltipContent
                        formatter={(value) => formatAUD(value as number)}
                        hideLabel
                      />
                    }
                  />
                  <PolarAngleAxis dataKey="category" tick={{ fontSize: 11 }} />
                  <PolarGrid />
                  <Radar
                    dataKey="amount"
                    fill="var(--color-primary)"
                    fillOpacity={0.6}
                  />
                </RadarChart>
              </ChartContainer>
            </CardContent>
            <CardFooter className="flex-col gap-2 text-sm">
              <div className="flex items-center gap-2 font-medium leading-none">
                {topCategory.category} leads at {topCategoryPct}% of spend
                <TrendingUp className="size-4" />
              </div>
              <div className="flex items-center gap-2 leading-none text-muted-foreground">
                Total: {formatAUD(totalExpenses)}
              </div>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
