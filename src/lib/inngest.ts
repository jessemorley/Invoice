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
