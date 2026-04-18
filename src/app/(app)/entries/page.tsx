export const dynamic = "force-dynamic";

import { EntriesView } from "@/components/entries-view";
import { fetchEntries, fetchInvoices } from "@/lib/queries";
import { fetchClients } from "./actions";
import { PROTOTYPE_USER_ID } from "@/lib/supabase";

export default async function EntriesPage() {
  const entries = await fetchEntries(PROTOTYPE_USER_ID);
  const [invoices, clients] = await Promise.all([
    fetchInvoices(PROTOTYPE_USER_ID, entries),
    fetchClients(),
  ]);
  return <EntriesView entries={entries} invoices={invoices} clients={clients} />;
}
