"use client";

import { useState } from "react";
import type { ComposePrefill, DashboardEmail, InvoiceDetail } from "@/lib/types";
import { loadScheduledEmail } from "@/app/(app)/invoices/actions";
import { formatRelativeTime } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { InvoiceStatusBadge } from "@/components/invoice-status-badge";
import { ClientSquircle } from "@/components/client-squircle";
import { EmailComposeSheet } from "@/components/email-compose-sheet";
import { SentEmailSheet } from "@/components/sent-email-sheet";
import { tableHeadCellBase } from "@/components/sortable-table-head";

function emailStatusLabel(email: DashboardEmail): string {
  if (email.status === "sent" && email.sent_at) return `Sent ${formatRelativeTime(email.sent_at)}`;
  if (email.status === "failed") return "Failed";
  return formatRelativeTime(email.scheduled_for);
}

function StatusCell({ email }: { email: DashboardEmail }) {
  return (
    <Badge variant={email.status === "failed" ? "destructive" : email.status === "sent" ? "secondary" : "outline"}>
      {email.status === "pending" ? "scheduled" : email.status}
    </Badge>
  );
}

function SkeletonTableRows({ count = 6 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <TableRow key={i}>
          <TableCell className="py-3 px-6"><Skeleton className="h-5 w-24 rounded-full" /></TableCell>
          <TableCell className="py-3 px-6">
            <div className="flex items-center gap-3">
              <Skeleton className="size-6 rounded-md" />
              <Skeleton className="h-4 w-24" />
            </div>
          </TableCell>
          <TableCell className="py-3 px-6"><Skeleton className="h-4 w-48" /></TableCell>
          <TableCell className="py-3 px-6"><Skeleton className="h-4 w-20" /></TableCell>
          <TableCell className="py-3 px-6 text-right"><Skeleton className="h-5 w-16 ml-auto rounded-full" /></TableCell>
        </TableRow>
      ))}
    </>
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

  const loading = !emails;

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
          <div className="rounded-lg border overflow-hidden bg-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className={`${tableHeadCellBase} w-24`}>Invoice</TableHead>
                  <TableHead className={`${tableHeadCellBase} w-48`}>To</TableHead>
                  <TableHead className={tableHeadCellBase}>Subject</TableHead>
                  <TableHead className={`${tableHeadCellBase} w-36`}>When</TableHead>
                  <TableHead className={`${tableHeadCellBase} w-24 text-right`}>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <SkeletonTableRows />
                ) : emails.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                      No emails yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  emails.map((email) => (
                    <TableRow key={email.id} className="cursor-pointer" onClick={() => handleEmailRowClick(email)}>
                      <TableCell className="py-3 px-6">
                        <InvoiceStatusBadge number={email.invoice_number} status={email.invoice_status} />
                      </TableCell>
                      <TableCell className="py-3 px-6">
                        {email.client_name ? (
                          <div className="flex items-center gap-3">
                            <ClientSquircle name={email.client_name} color={email.client_color ?? ""} className="size-[22px] shrink-0" />
                            <span className="text-sm truncate">{email.client_name}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground truncate">{email.to_address}</span>
                        )}
                      </TableCell>
                      <TableCell className="py-3 px-6 max-w-0">
                        <span className="text-sm text-muted-foreground block truncate">{email.subject}</span>
                      </TableCell>
                      <TableCell className="py-3 px-6 whitespace-nowrap">
                        <span className="text-xs text-muted-foreground">{emailStatusLabel(email)}</span>
                      </TableCell>
                      <TableCell className="py-3 px-6 text-right">
                        <StatusCell email={email} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
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
