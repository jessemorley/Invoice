import type { InvoiceDetail } from "./types";
import { formatAUD, formatDateShort } from "./format";

// Placeholders available in email body templates.
export const TEMPLATE_PLACEHOLDERS = [
  "{{name}}",
  "{{invoice_number}}",
  "{{amount}}",
  "{{due_date}}",
  "{{business_name}}",
] as const;

export const DEFAULT_INVOICE_TEMPLATE =
  "Hi {{name}},\n\nPlease find attached invoice {{invoice_number}} for {{amount}} due {{due_date}}.\n\nThanks,\n{{business_name}}";

export const DEFAULT_FOLLOWUP_TEMPLATE =
  "Hi {{name}},\n\nJust a friendly reminder that invoice {{invoice_number}} for {{amount}} (due {{due_date}}) is now due for payment.\n\nIf you've already paid, please disregard this email.\n\nThanks,\n{{business_name}}";

export type TemplateVars = {
  name: string;
  invoice_number: string;
  amount: string;
  due_date: string; // formatted, or "" when the invoice has no due date
  business_name: string;
};

export function renderEmailTemplate(template: string, vars: TemplateVars): string {
  let out = template;
  // ponytail: drop the common "due {{due_date}}" phrasings when there's no due
  // date instead of leaving a dangling "due ."; real conditional syntax if
  // templates ever grow beyond this.
  if (!vars.due_date) {
    out = out.replace(/\s*\(due {{due_date}}\)/g, "").replace(/\s*due {{due_date}}/g, "");
  }
  return out.replace(/{{(\w+)}}/g, (match, key: string) =>
    key in vars ? vars[key as keyof TemplateVars] : match
  );
}

export function invoiceTemplateVars(invoice: InvoiceDetail, businessName: string): TemplateVars {
  return {
    name: invoice.client.contact_name ?? invoice.client.name,
    invoice_number: invoice.number,
    amount: formatAUD(invoice.total),
    due_date: invoice.due_date ? formatDateShort(invoice.due_date) : "",
    business_name: businessName,
  };
}
