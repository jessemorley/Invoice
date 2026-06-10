import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { inngest } from "@/lib/inngest";
import type { WeeklyReminderScheduledEvent } from "@/lib/inngest";
import { sendPushToUser } from "@/lib/push";
import { isoWeek, weeklyCutoff, nextWeeklyCutoff } from "@/lib/format";

type DeferredCutoff = "friday_5pm" | "sunday_midnight";

// Mirrors the in-app "uninvoiced" badge logic in loadInvoicesViewData
// (src/app/(app)/actions.ts): group uninvoiced entries by client + ISO week,
// then count groups that are due — weekly clients only once their cutoff has
// elapsed, everyone else immediately.
async function uninvoicedDueCount(
  supabase: SupabaseClient,
  userId: string,
  cutoff: DeferredCutoff,
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
      if (now >= weeklyCutoff(g.isoWeek, cutoff)) count++;
    } else {
      count++;
    }
  }
  return count;
}

// Event-driven (no cron): triggered by a future-dated event Inngest holds until
// the cutoff, then re-schedules the following week's event. Cancelled when the
// matching invoice/weekly-reminder.cancelled event is sent (settings change).
export const weeklyInvoiceReminder = inngest.createFunction(
  {
    id: "weekly-invoice-reminder",
    triggers: [{ event: "invoice/weekly-reminder.scheduled" satisfies WeeklyReminderScheduledEvent["name"] }],
    cancelOn: [{ event: "invoice/weekly-reminder.cancelled", match: "data.user_id" }],
  },
  async ({ event }: { event: WeeklyReminderScheduledEvent }) => {
    const { user_id } = event.data;
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: pref } = await supabase
      .from("user_preferences")
      .select("weekly_invoice_reminder, weekly_invoice_reminder_cutoff")
      .eq("user_id", user_id)
      .maybeSingle();

    // Settings may have changed before this fired — stop the chain if no longer applicable.
    if (!pref?.weekly_invoice_reminder) return { stopped: "disabled" };
    const cutoff = pref.weekly_invoice_reminder_cutoff;
    if (cutoff !== "friday_5pm" && cutoff !== "sunday_midnight") return { stopped: "immediately" };

    const now = new Date();
    const count = await uninvoicedDueCount(supabase, user_id, cutoff, now);
    if (count > 0) {
      await sendPushToUser(user_id, {
        body: `You have ${count} ${count === 1 ? "client" : "clients"} with uninvoiced work.`,
        url: "/?view=invoices",
        badgeCount: count,
        tag: "weekly-invoice-reminder",
      });
    }

    // Always re-schedule, even when count is 0 — the chain must persist so the
    // user gets reminded the following week without needing a settings change.
    const next = nextWeeklyCutoff(cutoff, now);
    await inngest.send({
      name: "invoice/weekly-reminder.scheduled",
      data: { user_id, scheduled_for: next.toISOString() },
      ts: next.getTime(),
    });

    return { count, next: next.toISOString() };
  }
);
