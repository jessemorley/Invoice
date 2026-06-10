import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest";
import { sendInvoiceEmail } from "@/inngest/send-invoice-email";
import { weeklyInvoiceReminder } from "@/inngest/weekly-invoice-reminder";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [sendInvoiceEmail, weeklyInvoiceReminder],
});
