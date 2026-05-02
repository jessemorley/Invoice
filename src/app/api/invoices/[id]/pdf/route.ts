import type { NextRequest } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { fetchInvoiceDetail, fetchBusinessDetails } from "@/lib/queries";
import { PROTOTYPE_USER_ID } from "@/lib/supabase";
import { InvoiceDocument } from "@/components/invoice-document";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [invoice, business] = await Promise.all([
    fetchInvoiceDetail(id, PROTOTYPE_USER_ID),
    fetchBusinessDetails(PROTOTYPE_USER_ID),
  ]);

  if (!invoice) {
    return new Response("Invoice not found", { status: 404 });
  }

  const element = React.createElement(InvoiceDocument, {
    invoice,
    business: business ?? ({} as NonNullable<typeof business>),
  });

  // renderToBuffer returns a Node Buffer; cast to Uint8Array for web Response
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(element as any);
  const bytes = new Uint8Array(buffer);
  const businessName = business?.business_name ?? "";
  const filename = businessName
    ? `${businessName} Invoice ${invoice.number}.pdf`
    : `Invoice ${invoice.number}.pdf`;

  return new Response(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(bytes.byteLength),
    },
  });
}
