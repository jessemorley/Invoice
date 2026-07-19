import { createClient } from "@supabase/supabase-js";
import { revalidateTag } from "next/cache";
import { Resend } from "resend";
import { NonRetriableError } from "inngest";
import { inngest } from "@/lib/inngest";
import type { SendInvoiceEmailEvent } from "@/lib/inngest";
import { sendPushToUser } from "@/lib/push";
import { CACHE_TAGS } from "@/lib/queries";

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
    onFailure: async ({ event, error }) => {
      const { scheduled_email_id, user_id, invoice_id, to_address, subject, mark_issued } =
        event.data.event.data as SendInvoiceEmailEvent["data"];
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      // Only flip pending rows: a run can fail after the success path already
      // marked the row sent, and cancelled rows must stay cancelled.
      await supabase
        .from("scheduled_emails")
        .update({ status: "failed", error: error.message })
        .eq("id", scheduled_email_id)
        .eq("status", "pending");
      // Status changed outside a server action, so expire the affected cache
      // tags here; updateTag is unavailable in this (route handler) context.
      revalidateTag(CACHE_TAGS.scheduledEmails, { expire: 0 });
      revalidateTag(CACHE_TAGS.invoices, { expire: 0 });
      if (mark_issued && invoice_id) {
        // mark_as_issued_on_send stamps issued_date at schedule time but only
        // flips status to "issued" on a *successful* send. On failure the
        // invoice is usually still "draft", so match both states to undo the
        // stamp; never touch a "paid" invoice.
        await supabase
          .from("invoices")
          .update({ status: "draft", issued_date: null })
          .eq("id", invoice_id)
          .in("status", ["draft", "issued"]);
        revalidateTag(CACHE_TAGS.entries, { expire: 0 });
      }
      // Best-effort push notification — never fail the handler over a notification.
      await sendPushToUser(user_id, {
        title: "⚠️ Invoice email failed",
        body: `${subject} to ${to_address} could not be sent. Tap to retry.`,
        url: "/?view=invoices",
        tag: `failed-${invoice_id}`,
      }).catch((err) => {
        console.error(JSON.stringify({ event: "invoice_failed_push_failed", invoice_id, error: err?.message }));
      });
    },
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
    } = event.data;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const resend = new Resend(process.env.RESEND_API_KEY!);
    const fromAddress = `Jesse Morley <${process.env.FROM_ADDRESS!}>`;
    const nextjsBaseUrl = process.env.NEXTJS_BASE_URL!;

    // Free-form emails (no invoice) skip the PDF entirely.
    let attachments: { filename: string; content: string }[] | undefined;
    let sentPdfPath: string | null = null;

    if (invoice_id && filename) {
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

      const storagePath = `${user_id}/${invoice_id}/${scheduled_email_id}.pdf`;
      const uploadResult = await supabase.storage
        .from("invoices")
        .upload(storagePath, pdfBytes, { contentType: "application/pdf", upsert: true })
        .catch((err: unknown) => ({ error: err }));
      if (uploadResult.error) {
        const err = uploadResult.error as { message?: string };
        console.error(
          JSON.stringify({
            event: "sent_pdf_archive_failed",
            scheduled_email_id,
            invoice_id,
            user_id,
            storage_path: storagePath,
            error: err?.message ?? String(uploadResult.error),
          })
        );
      }
      sentPdfPath = uploadResult.error ? null : storagePath;
      attachments = [{ filename, content: pdfBase64 }];
    }

    const { data: sendData, error: sendError } = await resend.emails.send({
      from: fromAddress,
      to: to_address.split(",").map((e: string) => e.trim()),
      cc: cc_address ? cc_address.split(",").map((e: string) => e.trim()) : undefined,
      bcc: bcc_address ? bcc_address.split(",").map((e: string) => e.trim()) : undefined,
      subject,
      text: body_text,
      attachments,
    });
    // The SDK returns errors instead of throwing — surface them so Inngest retries.
    if (sendError) throw new Error(`Resend send failed: ${sendError.message}`);

    await supabase
      .from("scheduled_emails")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        resend_id: sendData?.id ?? null,
        ...(sentPdfPath ? { sent_pdf_path: sentPdfPath } : {}),
      })
      .eq("id", scheduled_email_id);
    revalidateTag(CACHE_TAGS.scheduledEmails, { expire: 0 });

    // Best-effort push notification — never fail the job over a notification.
    await sendPushToUser(user_id, {
      title: "✉️ Invoice sent",
      body: `${subject} was delivered to ${to_address}.`,
      url: "/?view=invoices",
      tag: `sent-${invoice_id}`,
    }).catch((err) => {
      console.error(JSON.stringify({ event: "invoice_sent_push_failed", invoice_id, error: err?.message }));
    });

    if (mark_issued && invoice_id) {
      await supabase
        .from("invoices")
        .update({ status: "issued" })
        .eq("id", invoice_id)
        .eq("status", "draft");
      revalidateTag(CACHE_TAGS.invoices, { expire: 0 });
      revalidateTag(CACHE_TAGS.entries, { expire: 0 });
    }
  }
);
