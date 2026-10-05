import type { NextRequest } from "next/server";
import { renderInvoicePdf } from "@/lib/render-invoice-pdf";
import { createClient } from "@/lib/supabase-server";

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
  const token = sessionData.session.access_token;
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    return new Response("Unauthorized", { status: 401 });
  }
  const userId = claimsData.claims.sub;

  const result = await renderInvoicePdf(id, userId, token);
  if (!result) return new Response("Invoice not found", { status: 404 });
  return pdfResponse(result);
}

// Internal callers (e.g. the Inngest email job) now call renderInvoicePdf
// directly in-process — see src/lib/render-invoice-pdf.ts. The POST path
// remains for out-of-process callers: INTERNAL_API_SECRET authenticates the
// caller and the user JWT satisfies RLS when fetching invoice data.
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

  // Decode the JWT payload to verify it belongs to the claimed user.
  // The INTERNAL_API_SECRET above already authenticates the caller; this
  // prevents a compromised caller from accessing another user's data.
  let tokenSub: string | undefined;
  try {
    const payload = JSON.parse(Buffer.from(userToken.split(".")[1], "base64url").toString());
    tokenSub = payload.sub;
  } catch {
    return new Response("Invalid token", { status: 403 });
  }
  if (!tokenSub || tokenSub !== userId) {
    return new Response("Token/user_id mismatch", { status: 403 });
  }

  const result = await renderInvoicePdf(id, userId, userToken);
  if (!result) return new Response("Invoice not found", { status: 404 });
  return pdfResponse(result);
}
