"use client";

import { useState } from "react";
import type { DashboardData, DashboardEmail, InvoiceDetail } from "@/lib/types";
import { formatAUD, formatRelativeTime } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
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
import { Area, AreaChart, XAxis, YAxis } from "recharts";
import { EmailComposeSheet } from "@/components/email-compose-sheet";
import { SentEmailSheet } from "@/components/sent-email-sheet";
import { loadScheduledEmail } from "@/app/(app)/invoices/actions";

function fyLabel(year: number, month: number): string {
  // AU financial year: July (6) – June. If month >= 6, FY is year/year+1, else year-1/year.
  const startYear = month >= 6 ? year : year - 1;
  return `FY ${String(startYear).slice(2)}–${String(startYear + 1).slice(2)}`;
}

const now = new Date();
const currentFY = fyLabel(now.getFullYear(), now.getMonth());
const priorFY = fyLabel(now.getFullYear() - 1, now.getMonth());

const chartConfig = {
  current: { label: currentFY, color: "var(--color-primary)" },
  prior: { label: priorFY, color: "var(--color-muted-foreground)" },
};

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
  const [composeOpen, setComposeOpen] = useState(false);
  const [sentSheetOpen, setSentSheetOpen] = useState(false);
  const [composeInvoice, setComposeInvoice] = useState<InvoiceDetail | null>(null);
  const [composeBusinessName, setComposeBusinessName] = useState("");
  const [composePrefill, setComposePrefill] = useState<{ to: string[]; subject: string; body: string } | null>(null);
  const [sentEmail, setSentEmail] = useState<DashboardEmail | null>(null);

  if (!data) return <DashboardSkeleton />;
  const { mtdEarnings, mtdPriorMonth, outstanding, monthlyEarnings, emails } = data;
  const delta = mtdEarnings - mtdPriorMonth;
  const deltaPercent = mtdPriorMonth > 0 ? ((delta / mtdPriorMonth) * 100).toFixed(0) : "0";
  const isUp = delta >= 0;

  const now = new Date();
  const priorMonthName = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    .toLocaleDateString("en-AU", { month: "short" });

  const scheduledEmails = emails.filter((e) => e.status === "pending" || e.status === "failed");
  const recentEmails = emails.filter((e) => e.status === "sent");

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
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
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
                    className="flex items-center justify-between py-2 px-3 rounded-md border border-border hover:bg-accent/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-sm font-medium shrink-0">{email.invoice_number}</span>
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

          {/* 6-month earnings chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">6-month earnings</CardTitle>
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
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, name) => (
                          <>
                            <span className="text-muted-foreground">{chartConfig[name as keyof typeof chartConfig]?.label ?? name}</span>
                            <span className="font-mono font-medium tabular-nums ml-auto pl-4">
                              {new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(Number(value))}
                            </span>
                          </>
                        )}
                      />
                    }
                  />
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

      <EmailComposeSheet
        open={composeOpen}
        onOpenChange={setComposeOpen}
        invoice={composeInvoice}
        businessName={composeBusinessName}
        onSent={() => { setComposeInvoice(null); setComposePrefill(null); }}
        initialTo={composePrefill?.to}
        initialSubject={composePrefill?.subject}
        initialBody={composePrefill?.body}
      />
      <SentEmailSheet
        open={sentSheetOpen}
        onOpenChange={setSentSheetOpen}
        email={sentEmail}
      />
    </div>
  );
}
