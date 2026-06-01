"use client";

import { useState } from "react";
import type { ComposePrefill, DashboardData, DashboardEmail, InvoiceDetail } from "@/lib/types";
import { formatAUD, formatRelativeTime } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { InvoiceStatusBadge } from "@/components/invoice-status-badge";
import { ClientSquircle } from "@/components/client-squircle";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { TrendingDown, TrendingUp, BarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Area, AreaChart, Bar, BarChart, XAxis, YAxis } from "recharts";
import { EmailComposeSheet } from "@/components/email-compose-sheet";
import { SentEmailSheet } from "@/components/sent-email-sheet";
import { loadScheduledEmail } from "@/app/(app)/invoices/actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function fyLabel(year: number, month: number): string {
  // AU financial year: July (6) – June. If month >= 6, FY is year/year+1, else year-1/year.
  const startYear = month >= 6 ? year : year - 1;
  return `FY${String(startYear + 1).slice(2)}`;
}

const audFormatter = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });
function formatChartAUD(value: number) { return audFormatter.format(value); }


function DashboardSkeleton() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Dashboard" />
      <div className="flex-1 overflow-y-auto pb-28 md:pb-0">
        <div className="px-4 md:px-6 py-6 mx-auto w-full max-w-6xl grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-8 w-32 mt-1" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-3 w-48" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-36 mt-1" />
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-9 w-full rounded-md" />)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-32 mt-1" />
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-9 w-full rounded-md" />)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-48 mt-1" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-48 w-full rounded-md" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function emailStatusLabel(email: DashboardEmail): string {
  if (email.status === "sent" && email.sent_at) return `Sent ${formatRelativeTime(email.sent_at)}`;
  if (email.status === "failed") return "Failed";
  return formatRelativeTime(email.scheduled_for);
}

export function DashboardClient({ data }: { data?: DashboardData }) {
  const [timeframe, setTimeframe] = useState<26 | 52>(26);
  const [chartMode, setChartMode] = useState<"cumulative" | "monthly">("cumulative");
  const [composeOpen, setComposeOpen] = useState(false);
  const [sentSheetOpen, setSentSheetOpen] = useState(false);
  const [composeInvoice, setComposeInvoice] = useState<InvoiceDetail | null>(null);
  const [composeBusinessName, setComposeBusinessName] = useState("");
  const [composePrefill, setComposePrefill] = useState<ComposePrefill | null>(null);
  const [sentEmail, setSentEmail] = useState<DashboardEmail | null>(null);

  if (!data) return <DashboardSkeleton />;
  const { mtdEarnings, mtdPriorMonth, mtdDailyCumulative, mtdPriorCumulative, outstanding, weeklyEarnings, emails } = data;
  const weekSlice = timeframe === 26 ? weeklyEarnings.slice(26) : weeklyEarnings;

  // Cumulative mode: running total across weeks
  const cumulativeData = weekSlice.reduce<{ idx: number; week: string; current: number; prior: number }[]>(
    (acc, w, i) => {
      const prev = acc[i - 1];
      acc.push({ idx: i, week: w.week, current: (prev?.current ?? 0) + w.current, prior: (prev?.prior ?? 0) + w.prior });
      return acc;
    },
    []
  );
  const allMonthTicks = cumulativeData
    .filter((d, i) => i === 0 || cumulativeData[i - 1].week !== d.week)
    .map((d) => d.idx);
  const monthChangeTicks = timeframe === 52
    ? allMonthTicks.filter((_, i) => i % 2 === 0)
    : allMonthTicks;

  // Monthly mode: re-bucket weekly slice into calendar months keyed by yearMonth ("YYYY-MM")
  // to avoid collisions when the same month name appears twice in a 12-month window (e.g. two "Jan"s).
  const monthlyMap = new Map<string, { label: string; current: number; prior: number }>();
  for (const w of weekSlice) {
    const existing = monthlyMap.get(w.yearMonth) ?? { label: w.week, current: 0, prior: 0 };
    monthlyMap.set(w.yearMonth, { label: w.week, current: existing.current + w.current, prior: existing.prior + w.prior });
  }
  const monthlyData = Array.from(monthlyMap.values()).map(({ label, current, prior }) => ({ month: label, current, prior }));
  const delta = mtdEarnings - mtdPriorMonth;
  const deltaPercent = mtdPriorMonth > 0 ? ((delta / mtdPriorMonth) * 100).toFixed(0) : "0";
  const isUp = delta >= 0;

  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const currentFY = fyLabel(lastMonth.getFullYear(), lastMonth.getMonth());
  const priorFY = fyLabel(lastMonth.getFullYear() - 1, lastMonth.getMonth());
  const chartConfig = {
    current: { label: currentFY, color: "var(--color-primary)" },
    prior: { label: priorFY, color: "var(--color-muted-foreground)" },
  };
  const priorMonthName = lastMonth.toLocaleDateString("en-AU", { month: "short" });
  const currentMonthName = now.toLocaleDateString("en-AU", { month: "short" });
  const sparklineConfig = {
    cumulative: { label: currentMonthName, color: "var(--color-primary)" },
    prior: { label: priorMonthName, color: "var(--color-muted-foreground)" },
    projection: { label: "", color: "var(--color-primary)" },
  };
  const priorByDay = new Map(mtdPriorCumulative.map((pt) => [pt.day, pt.cumulative]));
  const currentByDay = new Map(mtdDailyCumulative.map((pt) => [pt.day, pt.cumulative]));
  const chartDays = Math.max(
    mtdPriorCumulative.at(-1)?.day ?? 0,
    mtdDailyCumulative.at(-1)?.day ?? 0
  );
  const todayDayOfMonth = mtdDailyCumulative.at(-1)?.day ?? 0;
  const sparklineData = Array.from({ length: chartDays }, (_, i) => ({
    day: i + 1,
    cumulative: currentByDay.get(i + 1) ?? null,
    prior: priorByDay.get(i + 1) ?? null,
    // Flat dotted projection line from today → end of month
    projection: i + 1 >= todayDayOfMonth ? mtdEarnings : null,
  }));
  const xTicks = [1, 5, 10, 15, 20, 25, chartDays].filter(
    (d, i, arr) => arr.indexOf(d) === i
  );

  const scheduledEmails = emails.filter((e) => e.status === "pending" || e.status === "failed");

  async function handleEmailRowClick(email: DashboardEmail) {
    if (email.status === "sent") {
      setSentEmail(email);
      setSentSheetOpen(true);
      return;
    }
    const result = await loadScheduledEmail(email.invoice_id);
    if (result.invoiceDetail) {
      setComposeInvoice(result.invoiceDetail);
      setComposeBusinessName(result.businessName);
      setComposePrefill({
        to: email.to_address.split(",").map((s) => s.trim()).filter(Boolean),
        subject: email.subject,
        body: email.body_text,
        scheduledFor: new Date(email.scheduled_for),
        editingId: email.id,
      });
      setComposeOpen(true);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Dashboard" />

      <div className="flex-1 overflow-y-auto pb-28 md:pb-0">
        <div className="px-4 md:px-6 py-6 mx-auto w-full max-w-6xl grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* MTD Earnings */}
          <Card>
            <CardHeader>
              <CardDescription>
                Month to date — {now.toLocaleDateString("en-AU", { month: "long" })}
              </CardDescription>
              <CardTitle className="text-3xl tabular-nums">
                {formatAUD(mtdEarnings)}
              </CardTitle>
              <div className="flex items-center gap-2 pt-0.5">
                {isUp ? (
                  <TrendingUp className="size-3.5 text-success" />
                ) : (
                  <TrendingDown className="size-3.5 text-destructive" />
                )}
                <span className={cn("text-xs", isUp ? "text-success" : "text-destructive")}>
                  {isUp ? "+" : ""}{deltaPercent}% vs {priorMonthName}
                </span>
                <span className="text-xs text-muted-foreground ml-1">
                  ({priorMonthName} MTD: {formatAUD(mtdPriorMonth)})
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <ChartContainer config={sparklineConfig} className="h-48 w-full">
                <AreaChart data={sparklineData}>
                  <defs>
                    <linearGradient id="gradMtd" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="day"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11 }}
                    ticks={xTicks}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                    width={40}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(_label, payload) => `Day ${payload?.[0]?.payload?.day ?? ""}`}
                        formatter={(value, name) => (
                          <>
                            <span className="text-muted-foreground">{sparklineConfig[name as keyof typeof sparklineConfig]?.label ?? name}</span>
                            <span className="font-mono font-medium tabular-nums ml-auto pl-4">
                              {formatChartAUD(Number(value))}
                            </span>
                          </>
                        )}
                      />
                    }
                  />
                  <Area
                    dataKey="cumulative"
                    type="monotone"
                    stroke="var(--color-primary)"
                    strokeWidth={2}
                    fill="url(#gradMtd)"
                    dot={false}
                  />
                  <Area
                    dataKey="projection"
                    type="monotone"
                    stroke="var(--color-primary)"
                    strokeWidth={1.5}
                    strokeOpacity={0.35}
                    strokeDasharray="4 4"
                    fill="none"
                    dot={false}
                    legendType="none"
                  />
                  <Area
                    dataKey="prior"
                    type="monotone"
                    stroke="var(--color-muted-foreground)"
                    strokeWidth={1.5}
                    strokeOpacity={0.4}
                    fill="none"
                    dot={false}
                  />
                </AreaChart>
              </ChartContainer>
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
                {outstanding.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between py-2 px-3 rounded-lg border border-border hover:bg-accent/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <InvoiceStatusBadge number={invoice.number} status={invoice.status} />
                      <div className="flex items-center gap-1.5 min-w-0">
                        <ClientSquircle name={invoice.client.name} color={invoice.client.color} className="size-[22px] shrink-0" />
                        <span className="text-sm text-muted-foreground truncate">{invoice.client.name}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-sm tabular-nums">{formatAUD(invoice.total)}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            )}
          </Card>

          {/* Emails */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Emails</CardTitle>
              <CardDescription>
                {scheduledEmails.length === 0
                  ? "No scheduled emails"
                  : scheduledEmails.length === 1
                  ? "1 scheduled"
                  : `${scheduledEmails.length} scheduled`}
              </CardDescription>
            </CardHeader>
            {emails.length > 0 && (
              <CardContent className="flex flex-col gap-2">
                {emails.map((email) => (
                  <div
                    key={email.id}
                    onClick={() => handleEmailRowClick(email)}
                    className="flex items-center justify-between py-2 px-3 rounded-lg border border-border hover:bg-accent/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <InvoiceStatusBadge number={email.invoice_number} status={email.invoice_status} />
                      <span className="text-sm text-muted-foreground truncate">{email.to_address}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-xs text-muted-foreground hidden sm:block">{emailStatusLabel(email)}</span>
                      <Badge variant={email.status === "failed" ? "destructive" : email.status === "sent" ? "secondary" : "outline"}>
                        {email.status === "pending" ? "scheduled" : email.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            )}
          </Card>

          {/* Earnings chart */}
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-2">
              <div>
                <CardTitle className="text-sm font-medium">{timeframe === 26 ? 6 : 12}-month earnings</CardTitle>
                <CardDescription>
                  <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="h-2 w-6 rounded-sm bg-primary" />
                      <span>{currentFY}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="h-2 w-6 rounded-sm bg-muted-foreground/40" />
                      <span>{priorFY}</span>
                    </div>
                  </div>
                </CardDescription>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <div className="flex rounded-md border overflow-hidden">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Cumulative view"
                    className={cn("h-7 w-7 rounded-none", chartMode === "cumulative" && "bg-muted")}
                    onClick={() => setChartMode("cumulative")}
                  >
                    <TrendingUp className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Monthly view"
                    className={cn("h-7 w-7 rounded-none border-l", chartMode === "monthly" && "bg-muted")}
                    onClick={() => setChartMode("monthly")}
                  >
                    <BarChart2 className="size-3.5" />
                  </Button>
                </div>
                <Select value={String(timeframe)} onValueChange={(v) => setTimeframe(v === "52" ? 52 : 26)}>
                  <SelectTrigger className="w-28 h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="26">6 months</SelectItem>
                    <SelectItem value="52">12 months</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-48 w-full">
                {chartMode === "cumulative" ? (
                  <AreaChart data={cumulativeData}>
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
                      dataKey="idx"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11 }}
                      ticks={monthChangeTicks}
                      tickFormatter={(idx: number) => cumulativeData[idx]?.week ?? ""}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                      width={40}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          labelFormatter={(_value, payload) => payload[0]?.payload?.week ?? ""}
                          formatter={(value, name) => (
                            <>
                              <span className="text-muted-foreground">{chartConfig[name as keyof typeof chartConfig]?.label ?? name}</span>
                              <span className="font-mono font-medium tabular-nums ml-auto pl-4">
                                {formatChartAUD(Number(value))}
                              </span>
                            </>
                          )}
                        />
                      }
                    />
                    <Area dataKey="current" type="monotone" stroke="var(--color-primary)" strokeWidth={2} fill="url(#gradCurrent)" />
                    <Area dataKey="prior" type="monotone" stroke="var(--color-muted-foreground)" strokeWidth={1.5} strokeOpacity={0.4} fill="url(#gradPrior)" />
                  </AreaChart>
                ) : (
                  <BarChart data={monthlyData} barCategoryGap="20%">
                    <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                      width={40}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value, name) => (
                            <>
                              <span className="text-muted-foreground">{chartConfig[name as keyof typeof chartConfig]?.label ?? name}</span>
                              <span className="font-mono font-medium tabular-nums ml-auto pl-4">
                                {formatChartAUD(Number(value))}
                              </span>
                            </>
                          )}
                        />
                      }
                    />
                    <Bar dataKey="current" fill="var(--color-primary)" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="prior" fill="var(--color-muted-foreground)" fillOpacity={0.4} radius={[2, 2, 0, 0]} />
                  </BarChart>
                )}
              </ChartContainer>
            </CardContent>
          </Card>

        </div>
      </div>

      <EmailComposeSheet
        open={composeOpen}
        onOpenChangeAction={(open) => {
          setComposeOpen(open);
          if (!open) { setComposeInvoice(null); setComposePrefill(null); }
        }}
        invoice={composeInvoice}
        businessName={composeBusinessName}
        onSent={() => { setComposeInvoice(null); setComposePrefill(null); }}
        initialTo={composePrefill?.to}
        initialSubject={composePrefill?.subject}
        initialBody={composePrefill?.body}
        initialScheduledFor={composePrefill?.scheduledFor}
        editingId={composePrefill?.editingId}
      />
      <SentEmailSheet
        open={sentSheetOpen}
        onOpenChangeAction={setSentSheetOpen}
        email={sentEmail}
      />
    </div>
  );
}
