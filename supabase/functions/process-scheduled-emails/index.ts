import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@4";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);
const resend = new Resend(Deno.env.get("RESEND_API_KEY")!);
const NEXTJS_BASE_URL = Deno.env.get("NEXTJS_BASE_URL")!;
const FROM_ADDRESS = `Jesse Morley <${Deno.env.get("FROM_ADDRESS")!}>`;

Deno.serve(async () => {
  const now = new Date().toISOString();

  const { data: rows, error } = await supabase
    .from("scheduled_emails")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_for", now);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  let processed = 0;
  for (const row of rows ?? []) {
    try {
      // Mint a short-lived user session so the PDF route can query under RLS
      // without needing the service role key in the Next.js/Vercel environment.
      const { data: sessionData, error: sessionError } = await supabase.auth.admin.createSession({ userId: row.user_id });
      if (sessionError || !sessionData?.session) throw new Error(`Failed to mint user token: ${sessionError?.message}`);

      const pdfRes = await fetch(`${NEXTJS_BASE_URL}/api/invoices/${row.invoice_id}/pdf`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("INTERNAL_API_SECRET")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ user_id: row.user_id, token: sessionData.session.access_token }),
      });
      if (!pdfRes.ok) throw new Error(`PDF fetch failed: ${pdfRes.status}`);

      const pdfBytes = new Uint8Array(await pdfRes.arrayBuffer());
      let binary = "";
      const chunk = 8192;
      for (let i = 0; i < pdfBytes.length; i += chunk) {
        binary += String.fromCharCode(...pdfBytes.slice(i, i + chunk));
      }
      const pdfBase64 = btoa(binary);

      await resend.emails.send({
        from: FROM_ADDRESS,
        to: row.to_address.split(",").map((e: string) => e.trim()),
        cc: row.cc_address ? row.cc_address.split(",").map((e: string) => e.trim()) : undefined,
        bcc: row.bcc_address ? row.bcc_address.split(",").map((e: string) => e.trim()) : undefined,
        subject: row.subject,
        text: row.body_text,
        attachments: [{ filename: row.filename, content: pdfBase64 }],
      });

      await supabase
        .from("scheduled_emails")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", row.id);

      if (row.mark_issued && row.invoice_id) {
        const issuedDate = new Date(row.scheduled_for).toISOString().split("T")[0];
        await supabase
          .from("invoices")
          .update({ status: "issued", issued_date: issuedDate })
          .eq("id", row.invoice_id)
          .eq("status", "draft");
      }

      processed++;
    } catch (err) {
      await supabase
        .from("scheduled_emails")
        .update({
          status: "failed",
          error: err instanceof Error ? err.message : String(err),
        })
        .eq("id", row.id);
    }
  }

  return new Response(JSON.stringify({ processed }), {
    headers: { "Content-Type": "application/json" },
  });
});
