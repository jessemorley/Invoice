"use client";

import { useState } from "react";
import type { ComposePrefill, DashboardEmail, InvoiceDetail } from "@/lib/types";
import { loadScheduledEmail } from "@/app/(app)/invoices/actions";
import { formatRelativeTime } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { InvoiceStatusBadge } from "@/components/invoice-status-badge";
import { EmailComposeSheet } from "@/components/email-compose-sheet";
import { SentEmailSheet } from "@/components/sent-email-sheet";

function emailStatusLabel(email: DashboardEmail): string {
  if (email.status === "sent" && email.sent_at) return `Sent ${formatRelativeTime(email.sent_at)}`;
  if (email.status === "failed") return "Failed";
  return formatRelativeTime(email.scheduled_for);
}

function EmailRow({ email, onClick }: { email: DashboardEmail; onClick: () => void }) {
  return (
    <div onClick={onClick} className="flex items-center justify-between py-2.5 cursor-pointer">
      <div className="flex items-center gap-2.5 min-w-0">
        <InvoiceStatusBadge number={email.invoice_number} status={email.invoice_status} />
        <div className="min-w-0">
          <p className="text-sm truncate">{email.subject}</p>
          <p className="text-sm text-muted-foreground truncate">{email.to_address}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-2">
        <span className="text-xs text-muted-foreground hidden sm:block">{emailStatusLabel(email)}</span>
        <Badge variant={email.status === "failed" ? "destructive" : email.status === "sent" ? "secondary" : "outline"}>
          {email.status === "pending" ? "scheduled" : email.status}
        </Badge>
      </div>
    </div>
  );
}

export function EmailsClient({ emails }: { emails?: DashboardEmail[] }) {
  const [composeOpen, setComposeOpen] = useState(false);
  const [sentSheetOpen, setSentSheetOpen] = useState(false);
  const [composeInvoice, setComposeInvoice] = useState<InvoiceDetail | null>(null);
  const [composeBusinessName, setComposeBusinessName] = useState("");
  const [composeUserName, setComposeUserName] = useState("");
  const [composePrefill, setComposePrefill] = useState<ComposePrefill | null>(null);
  const [sentEmail, setSentEmail] = useState<DashboardEmail | null>(null);

  const scheduled = emails?.filter((e) => e.status === "pending" || e.status === "failed") ?? [];
  const sent = emails?.filter((e) => e.status === "sent") ?? [];

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
      setComposeUserName(result.userName);
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
      <PageHeader title="Emails" />

      <div className="flex-1 overflow-y-auto pb-28 md:pb-0">
        <div className="px-4 md:px-6 py-6 mx-auto w-full max-w-6xl flex flex-col gap-4">
          {!emails ? (
            <Card>
              <CardContent className="flex flex-col gap-3 py-6">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-2/3" />
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Scheduled</CardTitle>
                  <CardDescription>
                    {scheduled.length === 0
                      ? "No scheduled emails"
                      : `${scheduled.length} scheduled`}
                  </CardDescription>
                </CardHeader>
                {scheduled.length > 0 && (
                  <CardContent className="flex flex-col divide-y divide-border">
                    {scheduled.map((email) => (
                      <EmailRow key={email.id} email={email} onClick={() => handleEmailRowClick(email)} />
                    ))}
                  </CardContent>
                )}
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Sent</CardTitle>
                  <CardDescription>
                    {sent.length === 0 ? "No sent emails" : `${sent.length} sent`}
                  </CardDescription>
                </CardHeader>
                {sent.length > 0 && (
                  <CardContent className="flex flex-col divide-y divide-border">
                    {sent.map((email) => (
                      <EmailRow key={email.id} email={email} onClick={() => handleEmailRowClick(email)} />
                    ))}
                  </CardContent>
                )}
              </Card>
            </>
          )}
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
        userName={composeUserName}
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
