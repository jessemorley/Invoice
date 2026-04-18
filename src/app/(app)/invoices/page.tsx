import { fetchEntries, fetchInvoices } from "@/lib/queries";
import { PROTOTYPE_USER_ID } from "@/lib/supabase";
import { InvoicesClient } from "./invoices-client";

export default async function InvoicesPage() {
  const entries = await fetchEntries(PROTOTYPE_USER_ID);
  const invoices = await fetchInvoices(PROTOTYPE_USER_ID, entries);
  return <InvoicesClient invoices={invoices} entries={entries} />;
}
