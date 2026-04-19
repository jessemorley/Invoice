export const dynamic = "force-dynamic";

import { EntriesView } from "@/components/entries-view";
import { fetchEntries, fetchInvoicesByIds } from "@/lib/queries";
import { fetchClients } from "./actions";
import { PROTOTYPE_USER_ID } from "@/lib/supabase";

export default async function EntriesPage() {
  const [entries, clients] = await Promise.all([
    fetchEntries(PROTOTYPE_USER_ID),
    fetchClients(),
  ]);
  const invoiceIds = [...new Set(entries.map((e) => e.invoice_id).filter(Boolean) as string[])];
  const invoices = await fetchInvoicesByIds(invoiceIds);
  return <EntriesView entries={entries} invoices={invoices} clients={clients} />;
}
