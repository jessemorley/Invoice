"use server";

import { updateTag, refresh } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import { createTokenClient } from "@/lib/supabase";
import { getAuth, getAuthUserId } from "@/lib/auth";
import { sendTestPush } from "@/lib/push";
import { inngest } from "@/lib/inngest";
import { nextWeeklyCutoff } from "@/lib/format";
import {
  fetchBusinessDetails,
  fetchInvoiceSequence,
  fetchUserPreferences,
  CACHE_TAGS,
  type BusinessDetails,
  type InvoiceSequence,
  type UserPreferences,
  type WeeklyInvoiceReminderCutoff,
} from "@/lib/queries";

export type BusinessDetailsFormData = {
  name: string;
  business_name: string;
  abn: string;
  address: string;
  suburb: string;
  email: string;
  super_fund: string;
  super_fund_abn: string;
  super_usi: string;
  super_member_number: string;
  bsb: string;
  account_number: string;
};

export type InvoicingFormData = {
  invoice_prefix: string;
  next_invoice_number: number;
  due_date_offset: number;
};

export type EmailFormData = {
  mark_as_issued_on_send: boolean;
  bcc_self: boolean;
};

export type NotificationFormData = {
  weekly_invoice_reminder: boolean;
  weekly_invoice_reminder_cutoff: WeeklyInvoiceReminderCutoff;
};

export async function fetchSettings(): Promise<{
  businessDetails: BusinessDetails | null;
  invoiceSequence: InvoiceSequence | null;
  userPreferences: UserPreferences | null;
}> {
  const { userId, token } = await getAuth();
  const [businessDetails, invoiceSequence, userPreferences] = await Promise.all([
    fetchBusinessDetails(userId, token),
    fetchInvoiceSequence(userId, token),
    fetchUserPreferences(userId, token),
  ]);
  return { businessDetails, invoiceSequence, userPreferences };
}

export async function saveBusinessDetails(data: BusinessDetailsFormData) {
  const [supabase, userId] = await Promise.all([createClient(), getAuthUserId()]);
  const { error } = await supabase
    .from("business_details")
    .upsert(
      {
        user_id: userId,
        name: data.name,
        business_name: data.business_name,
        abn: data.abn,
        address: data.address,
        suburb: data.suburb,
        email: data.email,
        super_fund: data.super_fund,
        super_fund_abn: data.super_fund_abn,
        super_usi: data.super_usi,
        super_member_number: data.super_member_number,
        bsb: data.bsb,
        account_number: data.account_number,
      },
      { onConflict: "user_id" }
    );
  if (error) throw new Error(`saveBusinessDetails: ${error.message}`);
  updateTag(CACHE_TAGS.settings);
  refresh();
}

export async function saveInvoicingSettings(data: InvoicingFormData) {
  const [supabase, userId] = await Promise.all([createClient(), getAuthUserId()]);
  const { error } = await supabase
    .from("invoice_sequence")
    .upsert(
      {
        user_id: userId,
        invoice_prefix: data.invoice_prefix,
        last_number: data.next_invoice_number - 1,
        due_date_offset: data.due_date_offset,
      },
      { onConflict: "user_id" }
    );
  if (error) throw new Error(`saveInvoicingSettings: ${error.message}`);
  updateTag(CACHE_TAGS.settings);
  refresh();
}

export async function saveEmailSettings(data: EmailFormData) {
  const [supabase, userId] = await Promise.all([createClient(), getAuthUserId()]);
  const { error } = await supabase
    .from("user_preferences")
    .upsert({ user_id: userId, bcc_self: data.bcc_self, mark_as_issued_on_send: data.mark_as_issued_on_send }, { onConflict: "user_id" });
  if (error) throw new Error(`saveEmailSettings: ${error.message}`);
  updateTag(CACHE_TAGS.settings);
  refresh();
}

export async function saveEmailTemplate(which: "invoice" | "followup", body: string | null) {
  const [supabase, userId] = await Promise.all([createClient(), getAuthUserId()]);
  const column = which === "invoice" ? "invoice_email_template" : "followup_email_template";
  // Column not in generated DB types until `supabase gen types` is re-run.
  const { error } = await supabase
    .from("user_preferences")
    .upsert({ user_id: userId, [column]: body } as never, { onConflict: "user_id" });
  if (error) throw new Error(`saveEmailTemplate: ${error.message}`);
  updateTag(CACHE_TAGS.settings);
  refresh();
}

export type PushSubscriptionData = {
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent?: string;
};

export async function savePushSubscription(sub: PushSubscriptionData) {
  const { userId, token } = await getAuth();
  const supabase = createTokenClient(token);
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: sub.endpoint,
      p256dh: sub.p256dh,
      auth: sub.auth,
      user_agent: sub.user_agent ?? null,
    },
    { onConflict: "endpoint" }
  );
  if (error) throw new Error(`savePushSubscription: ${error.message}`);
}

export async function deletePushSubscription(endpoint: string) {
  const { userId, token } = await getAuth();
  const supabase = createTokenClient(token);
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .eq("user_id", userId);
  if (error) throw new Error(`deletePushSubscription: ${error.message}`);
}

export async function saveNotificationSettings(data: NotificationFormData) {
  const { userId, token } = await getAuth();
  const supabase = createTokenClient(token);

  // Fetch current prefs so we can detect whether the reminder chain needs to change.
  const current = await fetchUserPreferences(userId, token);

  const { error } = await supabase
    .from("user_preferences")
    .upsert(
      {
        user_id: userId,
        weekly_invoice_reminder: data.weekly_invoice_reminder,
        weekly_invoice_reminder_cutoff: data.weekly_invoice_reminder_cutoff,
      },
      { onConflict: "user_id" }
    );
  if (error) throw new Error(`saveNotificationSettings: ${error.message}`);

  // Only touch the Inngest chain when the reminder fields actually change.
  const reminderChanged =
    current?.weekly_invoice_reminder !== data.weekly_invoice_reminder ||
    current?.weekly_invoice_reminder_cutoff !== data.weekly_invoice_reminder_cutoff;

  if (reminderChanged) {
    // Cancel any in-flight chain, then re-seed for deferred cutoffs only.
    // "immediately" needs no push — the app is open when work is entered.
    await inngest.send({ name: "invoice/weekly-reminder.cancelled", data: { user_id: userId } });
    if (data.weekly_invoice_reminder && data.weekly_invoice_reminder_cutoff !== "immediately") {
      const next = nextWeeklyCutoff(data.weekly_invoice_reminder_cutoff, new Date());
      await inngest.send({
        name: "invoice/weekly-reminder.scheduled",
        data: { user_id: userId, scheduled_for: next.toISOString() },
        ts: next.getTime(),
      });
    }
  }

  updateTag(CACHE_TAGS.settings);
  refresh();
}

export async function sendTestPushNotification() {
  const { userId } = await getAuth();
  await sendTestPush(userId, {
    title: "🔔 Test notification",
    body: "Push notifications are working.",
    url: "/?view=settings",
    tag: "test-push",
  });
}
