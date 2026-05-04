import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest";
import { sendInvoiceEmail } from "@/inngest/send-invoice-email";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [sendInvoiceEmail],
});
