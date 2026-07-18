"use client";

import { useRef, useState } from "react";
import type { ComposePrefill, Invoice, InvoiceDetail } from "@/lib/types";
import type { ScheduledEmail } from "@/lib/queries";
import { loadScheduledEmail, cancelScheduledEmail, sendScheduledEmailNow } from "@/app/(app)/invoices/actions";
import { invalidate } from "@/lib/invalidate";
import { DEFAULT_FOLLOWUP_TEMPLATE, invoiceTemplateVars, renderEmailTemplate } from "@/lib/email-templates";
import { InvoiceSheet } from "@/components/invoice-sheet";
import { SentEmailSheet } from "@/components/sent-email-sheet";
import { EmailComposeSheet } from "@/components/email-compose-sheet";
import { RescheduleDialog } from "@/components/reschedule-dialog";

// Owns the invoice sheet and its full email workflow (compose, reschedule,
// send-now, cancel, sent-email viewer) for one selected invoice. Render
// `sheets` once in the host view and call `openInvoice` from any row click.
export function useInvoiceWorkflow({ onEntryClick }: { onEntryClick?: (entryId: string) => void } = {}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [scheduledEmail, setScheduledEmail] = useState<ScheduledEmail | null>(null);
  const [invoiceDetail, setInvoiceDetail] = useState<InvoiceDetail | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [userName, setUserName] = useState("");
  const [invoiceTemplate, setInvoiceTemplate] = useState<string | null>(null);
  const [sentEmailOpen, setSentEmailOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composePrefill, setComposePrefill] = useState<ComposePrefill | null>(null);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const composeSentRef = useRef(false);
  // Whether closing the compose sheet should return to the invoice sheet
  // (true when compose was launched from within it).
  const composeReturnRef = useRef(true);

  function openInvoice(inv: Invoice) {
    setSelectedInvoice(inv);
    setScheduledEmail(null);
    setInvoiceDetail(null);
    setSheetOpen(true);
    loadScheduledEmail(inv.id).then((result) => {
      setScheduledEmail(result.scheduledEmail);
      setInvoiceDetail(result.invoiceDetail);
      setBusinessName(result.businessName);
      setUserName(result.userName);
      setInvoiceTemplate(result.invoiceTemplate);
    });
  }

  function handleSendClick() {
    composeReturnRef.current = true;
    setSheetOpen(false);
    setComposePrefill(null);
    setComposeOpen(true);
  }

  // Open the compose sheet directly (no invoice sheet) with a friendly
  // payment-reminder template for the given invoice.
  function sendFollowUp(inv: Invoice) {
    setSelectedInvoice(inv);
    setScheduledEmail(null);
    setInvoiceDetail(null);
    loadScheduledEmail(inv.id).then((result) => {
      setScheduledEmail(result.scheduledEmail);
      setInvoiceDetail(result.invoiceDetail);
      setBusinessName(result.businessName);
      setUserName(result.userName);
      setInvoiceTemplate(result.invoiceTemplate);
      const detail = result.invoiceDetail;
      if (!detail) return;
      setComposePrefill({
        to: detail.client.email ? [detail.client.email] : [],
        subject: `Payment reminder: Invoice ${detail.number}`,
        body: renderEmailTemplate(
          result.followupTemplate ?? DEFAULT_FOLLOWUP_TEMPLATE,
          invoiceTemplateVars(detail, result.businessName, result.userName)
        ),
        scheduledFor: null,
      });
      composeReturnRef.current = false;
      setComposeOpen(true);
    });
  }

  async function handleCancelEmail(id: string) {
    await cancelScheduledEmail(id);
    invalidate("invoices");
    setScheduledEmail(null);
  }

  function handleEditEmail() {
    if (!scheduledEmail) return;
    composeReturnRef.current = true;
    setComposePrefill({
      to: scheduledEmail.to_address.split(",").map((s) => s.trim()).filter(Boolean),
      subject: scheduledEmail.subject,
      body: scheduledEmail.body_text,
      scheduledFor: new Date(scheduledEmail.scheduled_for),
      editingId: scheduledEmail.id,
    });
    setSheetOpen(false);
    setComposeOpen(true);
  }

  function handleReschedule() {
    if (!scheduledEmail) return;
    setSheetOpen(false);
    setRescheduleOpen(true);
  }

  async function handleSendNow(id: string) {
    await sendScheduledEmailNow(id);
    invalidate("invoices");
    setScheduledEmail((prev) => prev ? { ...prev, scheduled_for: new Date().toISOString() } : prev);
  }

  const sheets = (
    <>
      <InvoiceSheet
        open={sheetOpen}
        onOpenChangeAction={setSheetOpen}
        invoice={selectedInvoice}
        invoiceDetail={invoiceDetail}
        scheduledEmail={scheduledEmail}
        onSendClick={handleSendClick}
        onCancelEmail={handleCancelEmail}
        onEditEmail={handleEditEmail}
        onReschedule={handleReschedule}
        onSendNow={handleSendNow}
        onViewEmail={() => setSentEmailOpen(true)}
        onEntryClick={onEntryClick}
        onLineItemMutate={() => {
          if (selectedInvoice) {
            loadScheduledEmail(selectedInvoice.id).then((result) => {
              setScheduledEmail(result.scheduledEmail);
              setInvoiceDetail(result.invoiceDetail);
            });
          }
        }}
      />
      <SentEmailSheet
        open={sentEmailOpen}
        onOpenChangeAction={setSentEmailOpen}
        email={scheduledEmail && selectedInvoice && scheduledEmail.status !== "cancelled" ? {
          ...scheduledEmail,
          status: scheduledEmail.status as "pending" | "sent" | "failed",
          invoice_id: selectedInvoice.id,
          invoice_number: selectedInvoice.number,
          invoice_status: selectedInvoice.status,
          client_name: selectedInvoice.client.name,
          client_color: selectedInvoice.client.color,
        } : null}
      />
      <EmailComposeSheet
        open={composeOpen}
        onOpenChangeAction={(open) => {
          setComposeOpen(open);
          if (!open && !composeSentRef.current && composeReturnRef.current) setSheetOpen(true);
          if (!open) { composeSentRef.current = false; composeReturnRef.current = true; setComposePrefill(null); }
        }}
        invoice={invoiceDetail}
        businessName={businessName}
        userName={userName}
        bodyTemplate={invoiceTemplate}
        onSent={() => { composeSentRef.current = true; invalidate("invoices"); }}
        initialTo={composePrefill?.to}
        initialSubject={composePrefill?.subject}
        initialBody={composePrefill?.body}
        initialScheduledFor={composePrefill?.scheduledFor}
        editingId={composePrefill?.editingId}
      />
      <RescheduleDialog
        open={rescheduleOpen}
        onOpenChangeAction={(open) => {
          setRescheduleOpen(open);
          if (!open) setSheetOpen(true);
        }}
        scheduledEmailId={scheduledEmail?.id ?? null}
        currentScheduledFor={scheduledEmail?.scheduled_for ?? null}
        onRescheduled={(iso) => {
          setScheduledEmail((prev) => prev ? { ...prev, scheduled_for: iso } : prev);
        }}
      />
    </>
  );

  return { openInvoice, sendFollowUp, sheets, setSheetOpen };
}
