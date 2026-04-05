"use client";

import { DASHBOARD } from "@/lib/mock-data";
import { formatAUD } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { TrendingDown, TrendingUp } from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Area, AreaChart, XAxis, YAxis } from "recharts";

const STATUS_STYLES = {
  draft: "bg-muted text-muted-foreground",
  issued: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  paid: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
};

const chartConfig = {
  current: { label: "FY 25–26", color: "var(--color-primary)" },
  prior: { label: "FY 24–25", color: "var(--color-muted-foreground)" },
};

export default function DashboardPage() {
  const { mtdEarnings, mtdPriorMonth, outstanding, monthlyEarnings } = DASHBOARD;
  const delta = mtdEarnings - mtdPriorMonth;
  const deltaPercent = ((delta / mtdPriorMonth) * 100).toFixed(0);
  const isUp = delta >= 0;

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-4 md:px-6 border-b border-border">
        <h1 className="text-lg font-semibold text-foreground">Dashboard</h1>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 space-y-4">
          {/* MTD Earnings */}
          <Card>
            <CardHeader>
              <CardDescription className="text-xs uppercase tracking-wider font-medium">
                Month to date — April
              </CardDescription>
              <CardTitle className="text-3xl font-mono font-semibold tabular-nums">
                {formatAUD(mtdEarnings)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {isUp ? (
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                )}
                <span className={`text-xs font-mono ${isUp ? "text-emerald-500" : "text-red-500"}`}>
                  {isUp ? "+" : ""}{deltaPercent}% vs Mar
                </span>
                <span className="text-xs text-muted-foreground font-mono ml-1">
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
              <CardContent className="space-y-2">
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
        </div>
      </div>
    </div>
  );
}
