import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { fetchFYMonthlySummary, fetchBusinessDetails } from "@/lib/queries";
import { createClient } from "@/lib/supabase-server";
import { EarningsSummaryDocument } from "@/components/earnings-summary-document";

export async function GET() {
  const supabase = await createClient();
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session) {
    return new Response("Unauthorized", { status: 401 });
  }
  const token = sessionData.session.access_token;
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    return new Response("Unauthorized", { status: 401 });
  }
  const userId = claimsData.claims.sub;

  const [summary, business] = await Promise.all([
    fetchFYMonthlySummary(userId, token),
    fetchBusinessDetails(userId, token),
  ]);

  const element = React.createElement(EarningsSummaryDocument, {
    summary,
    business: business ?? null,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(element as any);
  const bytes = new Uint8Array(buffer);

  const name = business?.business_name;
  const filename = name
    ? `${name} ${summary.fyLabel} Earnings Summary.pdf`
    : `${summary.fyLabel} Earnings Summary.pdf`;

  return new Response(bytes.buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(bytes.byteLength),
    },
  });
}
