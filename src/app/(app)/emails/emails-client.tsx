"use client";

import { useState } from "react";
import type { ComposePrefill, DashboardEmail, InvoiceDetail } from "@/lib/types";
import { loadScheduledEmail, deleteEmails } from "@/app/(app)/invoices/actions";
import { invalidate } from "@/lib/invalidate";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ClientSquircle } from "@/components/client-squircle";
import { EmailComposeSheet } from "@/components/email-compose-sheet";
import { SentEmailSheet } from "@/components/sent-email-sheet";

function emailDate(email: DashboardEmail): string {
  const d = new Date(email.status === "sent" && email.sent_at ? email.sent_at : email.scheduled_for);
  return `${d.toLocaleDateString("en-AU", { month: "long" })} ${d.getDate()}`;
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
          <TableCell className="py-3 pl-4 pr-0 w-10"><Skeleton className="size-4" /></TableCell>
          <TableCell className="py-3 px-6">
            <div className="flex items-center gap-3">
              <Skeleton className="size-6 rounded-md" />
              <Skeleton className="h-4 w-24" />
            </div>
          </TableCell>
          <TableCell className="py-3 px-6"><Skeleton className="h-4 w-72" /></TableCell>
          <TableCell className="py-3 px-6 text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
        </TableRow>
      ))}
    </>
  );
}

function EmailsTable({
  title,
  emails,
  onRowClick,
  loading,
  emptyLabel,
  showStatus,
  selected,
  onToggle,
}: {
  title: string;
  emails: DashboardEmail[];
  onRowClick: (email: DashboardEmail) => void;
  loading?: boolean;
  emptyLabel?: string;
  showStatus?: boolean;
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center px-4 py-2.5">
        <span className="text-sm font-medium text-muted-foreground">{title}</span>
      </div>
      <div className="rounded-lg border overflow-hidden bg-card">
      <Table>
        <TableBody>
          {loading ? (
            <SkeletonTableRows />
          ) : emails.length === 0 ? (
            <TableRow>
              <TableCell colSpan={showStatus ? 5 : 4} className="text-center text-muted-foreground py-12">
                {emptyLabel}
              </TableCell>
            </TableRow>
          ) : (
            emails.map((email) => (
              <TableRow key={email.id} className="cursor-pointer" onClick={() => onRowClick(email)}>
                <TableCell className="py-3 pl-4 pr-0 w-10" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selected.has(email.id)}
                    onCheckedChange={() => onToggle(email.id)}
                    aria-label={`Select email to ${email.client_name ?? email.to_address}`}
                  />
                </TableCell>
                <TableCell className="py-3 px-6 w-48">
                  <div className="flex items-center gap-3 min-w-0">
                    {email.client_name && (
                      <ClientSquircle name={email.client_name} color={email.client_color ?? ""} className="size-[22px] shrink-0" />
                    )}
                    <span className="text-sm truncate">{email.to_address}</span>
                  </div>
                </TableCell>
                <TableCell className="py-3 px-6 max-w-0">
                  <span className="text-sm block truncate">
                    {email.subject}
                    <span className="text-muted-foreground"> · {email.body_text.replace(/\s+/g, " ")}</span>
                  </span>
                </TableCell>
                <TableCell className={`py-3 px-6 w-28 whitespace-nowrap ${showStatus ? "" : "text-right"}`}>
                  <span className="text-sm text-muted-foreground">{emailDate(email)}</span>
                </TableCell>
                {showStatus && (
                  <TableCell className="py-3 px-6 w-24 text-right">
                    <StatusCell email={email} />
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const loading = !emails;
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

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteEmails([...selected]);
      setSelected(new Set());
      invalidate("emails", "invoices");
      toast.success(selected.size === 1 ? "Email deleted" : `${selected.size} emails deleted`);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Emails">
        {selected.size > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={deleting}>
                Delete ({selected.size})
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Delete {selected.size === 1 ? "this email" : `${selected.size} emails`}?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Scheduled emails will be cancelled, and sent emails will be removed from history along with their archived PDFs. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </PageHeader>

      <div className="flex-1 overflow-y-auto pb-28 md:pb-0">
        <div className="px-4 md:px-6 py-6 mx-auto w-full max-w-6xl flex flex-col gap-4">
          {!loading && scheduled.length > 0 && (
            <EmailsTable title="Scheduled" emails={scheduled} onRowClick={handleEmailRowClick} showStatus selected={selected} onToggle={toggleSelected} />
          )}
          <EmailsTable
            title="Sent"
            emails={sent}
            onRowClick={handleEmailRowClick}
            loading={loading}
            emptyLabel="No sent emails yet."
            selected={selected}
            onToggle={toggleSelected}
          />
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
