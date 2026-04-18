import { EntriesView } from "@/components/entries-view";
import { fetchEntries, fetchInvoices } from "@/lib/queries";
import { PROTOTYPE_USER_ID } from "@/lib/supabase";

export default async function EntriesPage() {
  const entries = await fetchEntries(PROTOTYPE_USER_ID);
  const invoices = await fetchInvoices(PROTOTYPE_USER_ID, entries);
  return <EntriesView entries={entries} invoices={invoices} />;
}
