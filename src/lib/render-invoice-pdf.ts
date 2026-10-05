import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { fetchInvoiceDetail, fetchBusinessDetails, fetchInvoiceSequence } from "@/lib/queries";
import { InvoiceDocument } from "@/components/invoice-document";
import { computeDueDate } from "@/lib/utils";

export async function renderInvoicePdf(invoiceId: string, userId: string, token: string) {
  const [invoice, business] = await Promise.all([
    fetchInvoiceDetail(invoiceId, userId, token),
    fetchBusinessDetails(userId, token),
  ]);

  if (!invoice) return null;

  let dueDate = invoice.due_date;
  if (!dueDate && invoice.issued_date) {
    const seq = await fetchInvoiceSequence(userId, token);
    const offset = seq?.due_date_offset ?? 30;
    dueDate = computeDueDate(invoice.issued_date, offset);
  }

  const element = React.createElement(InvoiceDocument, {
    invoice: { ...invoice, due_date: dueDate },
    business: business ?? ({} as NonNullable<typeof business>),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(element as any);
  const bytes = new Uint8Array(buffer);
  const businessName = business?.business_name ?? "";
  const filename = businessName
    ? `${businessName} Invoice ${invoice.number}.pdf`
    : `Invoice ${invoice.number}.pdf`;

  return { bytes, filename };
}
