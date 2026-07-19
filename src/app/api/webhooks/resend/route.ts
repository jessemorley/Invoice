import { createClient } from "@supabase/supabase-js";
import { revalidateTag } from "next/cache";
import { Resend } from "resend";
import { sendPushToUser } from "@/lib/push";
import { CACHE_TAGS } from "@/lib/queries";

// Resend webhook (Svix-signed). Only email.bounced is subscribed; anything
// else is acknowledged and ignored.
export async function POST(req: Request) {
  const payload = await req.text();
  const resend = new Resend(process.env.RESEND_API_KEY!);

  let event;
  try {
    event = resend.webhooks.verify({
      payload,
      headers: {
        id: req.headers.get("svix-id") ?? "",
        timestamp: req.headers.get("svix-timestamp") ?? "",
        signature: req.headers.get("svix-signature") ?? "",
      },
      webhookSecret: process.env.RESEND_WEBHOOK_SECRET!,
    });
  } catch {
    return new Response("invalid signature", { status: 401 });
  }

  if (event.type !== "email.bounced") return Response.json({ received: true });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  // Only flip rows that reached "sent" — never resurrect cancelled/deleted rows.
  const { data: row, error } = await supabase
    .from("scheduled_emails")
    .update({ status: "bounced", error: event.data.bounce.message })
    .eq("resend_id", event.data.email_id)
    .eq("status", "sent")
    .select("user_id, subject, to_address")
    .maybeSingle();
  if (error) return new Response(`db update failed: ${error.message}`, { status: 500 });
  // No matching sent row (row deleted, already re-sent, or bounce raced the
  // sent-update): 404 makes Svix retry with backoff, then give up visibly.
  if (!row) return new Response("no matching sent row", { status: 404 });

  // Status changed outside a server action — expire the tag directly
  // (same pattern as the Inngest function).
  revalidateTag(CACHE_TAGS.scheduledEmails, { expire: 0 });
  revalidateTag(CACHE_TAGS.invoices, { expire: 0 });
  // Best-effort push notification — never fail the webhook over it.
  await sendPushToUser(row.user_id, {
    title: "⚠️ Email bounced",
    body: `${row.subject} to ${row.to_address} bounced. Tap to re-send.`,
    url: "/?view=emails",
    tag: `bounced-${event.data.email_id}`,
  }).catch((err) => {
    console.error(
      JSON.stringify({ event: "bounce_push_failed", email_id: event.data.email_id, error: err?.message })
    );
  });

  return Response.json({ received: true });
}
