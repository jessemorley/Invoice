import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { inngest } from "@/lib/inngest";
import { sendPushToUser } from "@/lib/push";
import { isoWeek, weeklyCutoff } from "@/lib/format";

type Cutoff = "immediately" | "friday_5pm" | "sunday_midnight";

// Mirrors the in-app "uninvoiced" badge logic in loadInvoicesViewData: group
// uninvoiced entries by client + ISO week, then count groups that are due —
// weekly clients only once their cutoff has elapsed, everyone else immediately.
async function uninvoicedDueCount(
  supabase: SupabaseClient,
  userId: string,
  cutoff: Cutoff,
  now: Date
): Promise<number> {
  const { data: entries, error } = await supabase
    .from("entries")
    .select("date, client_id, clients(invoice_frequency)")
    .eq("user_id", userId)
    .is("invoice_id", null);
  if (error || !entries) return 0;

  const groups = new Map<string, { isoWeek: string; weekly: boolean }>();
  for (const e of entries as Array<{ date: string; client_id: string | null; clients: { invoice_frequency: string } | { invoice_frequency: string }[] | null }>) {
    if (!e.client_id) continue;
    const client = Array.isArray(e.clients) ? e.clients[0] : e.clients;
    const week = isoWeek(e.date);
    const key = `${e.client_id}-${week}`;
    if (!groups.has(key)) {
      groups.set(key, { isoWeek: week, weekly: client?.invoice_frequency === "weekly" });
    }
  }

  let count = 0;
  for (const g of groups.values()) {
    if (g.weekly) {
      if (cutoff === "immediately" || now >= weeklyCutoff(g.isoWeek, cutoff)) count++;
    } else {
      count++;
    }
  }
  return count;
}

export const weeklyInvoiceReminder = inngest.createFunction(
  {
    id: "weekly-invoice-reminder",
    triggers: [{ cron: "TZ=Australia/Sydney 0 * * * *" }],
  },
  async () => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: prefs, error } = await supabase
      .from("user_preferences")
      .select("user_id, weekly_invoice_reminder, weekly_invoice_reminder_cutoff, weekly_reminder_last_sent_week")
      .eq("weekly_invoice_reminder", true);
    if (error || !prefs?.length) return { sent: 0 };

    // Current ISO week, computed from the Sydney wall-clock date.
    const now = new Date();
    const sydneyDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Australia/Sydney",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
    const currentWeek = isoWeek(sydneyDate);

    let sent = 0;
    for (const pref of prefs) {
      // Fire at most once per ISO week per user.
      if (pref.weekly_reminder_last_sent_week === currentWeek) continue;

      const cutoff = (pref.weekly_invoice_reminder_cutoff as Cutoff) ?? "immediately";
      const count = await uninvoicedDueCount(supabase, pref.user_id, cutoff, now);
      if (count <= 0) continue;

      await sendPushToUser(pref.user_id, {
        title: "Time to invoice",
        body: `You have ${count} ${count === 1 ? "client" : "clients"} with uninvoiced work.`,
        url: "/?view=invoices",
        badgeCount: count,
        tag: "weekly-invoice-reminder",
      });

      await supabase
        .from("user_preferences")
        .update({ weekly_reminder_last_sent_week: currentWeek })
        .eq("user_id", pref.user_id);
      sent++;
    }

    return { sent };
  }
);
