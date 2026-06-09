import { Inngest } from "inngest";

export const inngest = new Inngest({ id: "invoicing-pwa" });

export type SendInvoiceEmailEvent = {
  name: "invoice/email.scheduled";
  data: {
    scheduled_email_id: string;
    user_id: string;
    invoice_id: string;
    to_address: string;
    cc_address: string | null;
    bcc_address: string | null;
    subject: string;
    body_text: string;
    filename: string;
    mark_issued: boolean;
    scheduled_for: string;
  };
};

export type CancelInvoiceEmailEvent = {
  name: "invoice/email.cancelled";
  data: { scheduled_email_id: string };
};

// Self-rescheduling weekly "time to invoice" reminder. A single future-dated
// event is held by Inngest until its cutoff, then the handler re-sends the next
// one — no polling cron. Cancelled (and re-seeded) when notification settings change.
export type WeeklyReminderScheduledEvent = {
  name: "invoice/weekly-reminder.scheduled";
  data: { user_id: string; scheduled_for: string };
};

export type WeeklyReminderCancelledEvent = {
  name: "invoice/weekly-reminder.cancelled";
  data: { user_id: string };
};
