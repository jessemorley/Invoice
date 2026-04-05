"use client";

import { DASHBOARD, INVOICES } from "@/lib/mock-data";
import { formatAUD } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { TrendingDown, TrendingUp } from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Bar, BarChart, XAxis, YAxis } from "recharts";

const STATUS_STYLES = {
  draft: "bg-muted text-muted-foreground",
  issued: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  paid: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
};

const chartConfig = {
  current: { label: "This year", color: "var(--color-foreground)" },
  prior: { label: "Last year", color: "var(--color-muted-foreground)" },
};

export default function DashboardPage() {
  const { mtdEarnings, mtdPriorMonth, outstanding, monthlyEarnings } = DASHBOARD;
  const delta = mtdEarnings - mtdPriorMonth;
  const deltaPercent = ((delta / mtdPriorMonth) * 100).toFixed(0);
  const isUp = delta >= 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-4 md:px-6 border-b border-border">
        <h1 className="text-lg font-semibold text-foreground">Dashboard</h1>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 space-y-6">
          {/* MTD Earnings */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
              Month to date — April
            </p>
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-mono font-semibold tabular-nums text-foreground">
                {formatAUD(mtdEarnings)}
              </span>
              <div className="flex items-center gap-1">
                {isUp ? (
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                )}
                <span className={`text-xs font-mono ${isUp ? "text-emerald-500" : "text-red-500"}`}>
                  {isUp ? "+" : ""}{deltaPercent}% vs Mar
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground font-mono">
              Mar MTD: {formatAUD(mtdPriorMonth)}
            </p>
          </div>

          <Separator />

          {/* Outstanding invoices */}
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
              Outstanding
            </p>
            {outstanding.length === 0 ? (
              <p className="text-sm text-muted-foreground">All invoices paid</p>
            ) : (
              <div className="space-y-2">
                {outstanding.map(({ invoice }) => (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between py-2 px-3 rounded-md border border-border hover:bg-accent/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: invoice.client.color }}
                      />
                      <span className="text-sm font-mono font-medium">{invoice.number}</span>
                      <span className="text-sm text-muted-foreground">{invoice.client.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono tabular-nums">{formatAUD(invoice.total)}</span>
                      <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 font-medium ${STATUS_STYLES[invoice.status]}`}>
                        {invoice.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* 6-month earnings chart */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                6-month earnings
              </p>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-6 rounded-sm bg-foreground" />
                  <span>FY 25–26</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-6 rounded-sm bg-muted-foreground/40" />
                  <span>FY 24–25</span>
                </div>
              </div>
            </div>
            <ChartContainer config={chartConfig} className="h-48 w-full">
              <BarChart data={monthlyEarnings} barGap={2}>
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
                <Bar
                  dataKey="prior"
                  fill="var(--color-muted-foreground)"
                  opacity={0.3}
                  radius={[2, 2, 0, 0]}
                />
                <Bar
                  dataKey="current"
                  fill="var(--color-foreground)"
                  radius={[2, 2, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
