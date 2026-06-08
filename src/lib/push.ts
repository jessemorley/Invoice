import "server-only";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

export type PushPayload = {
  title: string;
  body?: string;
  url?: string;
  icon?: string;
  badgeCount?: number;
  tag?: string;
};

let configured = false;
function configureWebPush(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return false;
  if (!configured) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
  }
  return true;
}

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Sends a Web Push notification to every registered device for a user.
 * Best-effort: never throws. Prunes endpoints Apple/FCM report as gone
 * (404/410) so the subscriptions table stays clean.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!configureWebPush()) return;

  const supabase = adminClient();
  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (error || !subs?.length) return;

  const body = JSON.stringify(payload);
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body
        );
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        } else {
          console.error(
            JSON.stringify({
              event: "push_send_failed",
              user_id: userId,
              status_code: statusCode,
              error: err instanceof Error ? err.message : String(err),
            })
          );
        }
      }
    })
  );
}
