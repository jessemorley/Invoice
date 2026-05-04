import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { NonRetriableError } from "inngest";
import { inngest } from "@/lib/inngest";
import type { SendInvoiceEmailEvent } from "@/lib/inngest";

async function mintUserToken(userEmail: string): Promise<string> {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: userEmail,
  });
  if (linkError || !linkData.properties?.hashed_token) {
    throw new Error(`generateLink failed: ${linkError?.message}`);
  }

  const { data: sessionData, error: sessionError } = await anon.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: "email",
  });
  if (sessionError || !sessionData.session) {
    throw new Error(`verifyOtp failed: ${sessionError?.message}`);
  }

  return sessionData.session.access_token;
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

    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(user_id);
    if (userError || !userData.user?.email) {
      throw new NonRetriableError(`Failed to fetch user: ${userError?.message}`);
    }

    const userToken = await mintUserToken(userData.user.email).catch((err) => {
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
