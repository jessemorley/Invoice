import type { NextRequest } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { fetchInvoiceDetail, fetchBusinessDetails } from "@/lib/queries";
import { createClient } from "@/lib/supabase-server";
import { createTokenClient } from "@/lib/supabase";
import { InvoiceDocument } from "@/components/invoice-document";

async function renderPdf(invoiceId: string, userId: string, token: string) {
  const [invoice, business] = await Promise.all([
    fetchInvoiceDetail(invoiceId, userId, token),
    fetchBusinessDetails(userId, token),
  ]);

  if (!invoice) return null;

  const element = React.createElement(InvoiceDocument, {
    invoice,
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

function pdfResponse(result: { bytes: Uint8Array; filename: string }) {
  return new Response(result.bytes.buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
      "Content-Length": String(result.bytes.byteLength),
    },
  });
}

// Browser download: authenticated session cookie
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session) {
    return new Response("Unauthorized", { status: 401 });
  }
  const userId = sessionData.session.user.id;
  const token = sessionData.session.access_token;

  const result = await renderPdf(id, userId, token);
  if (!result) return new Response("Invoice not found", { status: 404 });
  return pdfResponse(result);
}

// Edge function path: passes INTERNAL_API_SECRET + a short-lived user JWT minted
// via supabase.auth.admin.signInAsUser in the edge function. The secret validates
// the caller; the token is used to satisfy RLS when fetching invoice data.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const secret = process.env.INTERNAL_API_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const userId: string | undefined = body?.user_id;
  const userToken: string | undefined = body?.token;
  if (!userId || !userToken) {
    return new Response("Missing user_id or token", { status: 400 });
  }

  // Validate that the token actually belongs to this user before using it
  const supabase = createTokenClient(userToken);
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims || claims.claims.sub !== userId) {
    return new Response("Token/user_id mismatch", { status: 403 });
  }

  const result = await renderPdf(id, userId, userToken);
  if (!result) return new Response("Invoice not found", { status: 404 });
  return pdfResponse(result);
}
