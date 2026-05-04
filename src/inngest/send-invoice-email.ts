import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { NonRetriableError } from "inngest";
import { inngest } from "@/lib/inngest";
import type { SendInvoiceEmailEvent } from "@/lib/inngest";

async function mintUserToken(userId: string): Promise<string> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  const url = `${supabaseUrl.replace(/\/$/, "")}/auth/v1/admin/users/${userId}/session`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ never_expires: false }),
  });
  if (!res.ok) throw new Error(`mintUserToken failed: ${res.status} ${await res.text()}`);
  const { access_token } = await res.json();
  return access_token as string;
}

export const sendInvoiceEmail = inngest.createFunction(
  {
    id: "send-invoice-email",
    retries: 3,
    triggers: [{ event: "invoice/email.scheduled" satisfies SendInvoiceEmailEvent["name"] }],
    cancelOn: [
      {
        event: "invoice/email.cancelled",
        match: "data.scheduled_email_id",
      },
    ],
  },
  async ({ event }: { event: SendInvoiceEmailEvent }) => {
    const {
      scheduled_email_id,
      user_id,
      invoice_id,
      to_address,
      cc_address,
      bcc_address,
      subject,
      body_text,
      filename,
      mark_issued,
      scheduled_for,
    } = event.data;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const resend = new Resend(process.env.RESEND_API_KEY!);
    const fromAddress = `Jesse Morley <${process.env.FROM_ADDRESS!}>`;
    const nextjsBaseUrl = process.env.NEXTJS_BASE_URL!;

    const userToken = await mintUserToken(user_id).catch((err) => {
      throw new NonRetriableError(`Failed to mint user token: ${err.message}`);
    });

    const pdfRes = await fetch(`${nextjsBaseUrl}/api/invoices/${invoice_id}/pdf`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.INTERNAL_API_SECRET}`,
        "Content-Type": "application/json",
        "x-vercel-protection-bypass": process.env.VERCEL_BYPASS_SECRET ?? "",
      },
      body: JSON.stringify({ user_id, token: userToken }),
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
      from: fromAddress,
      to: to_address.split(",").map((e: string) => e.trim()),
      cc: cc_address ? cc_address.split(",").map((e: string) => e.trim()) : undefined,
      bcc: bcc_address ? bcc_address.split(",").map((e: string) => e.trim()) : undefined,
      subject,
      text: body_text,
      attachments: [{ filename, content: pdfBase64 }],
    });

    await supabase
      .from("scheduled_emails")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", scheduled_email_id);

    if (mark_issued && invoice_id) {
      const issuedDate = new Date(scheduled_for).toISOString().split("T")[0];
      await supabase
        .from("invoices")
        .update({ status: "issued", issued_date: issuedDate })
        .eq("id", invoice_id)
        .eq("status", "draft");
    }
  }
);
