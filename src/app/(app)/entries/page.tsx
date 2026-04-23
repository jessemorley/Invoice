import { Suspense } from "react";
import { EntriesView } from "@/components/entries-view";
import { fetchEntries } from "@/lib/queries";
import { fetchClients, loadWorkflowRates } from "./actions";
import { PROTOTYPE_USER_ID } from "@/lib/supabase";

async function EntriesData() {
  const [entries, clients, workflowRates] = await Promise.all([
    fetchEntries(PROTOTYPE_USER_ID),
    fetchClients(),
    loadWorkflowRates(),
  ]);
  return <EntriesView entries={entries} clients={clients} workflowRates={workflowRates} />;
}

export default function EntriesPage() {
  return (
    <Suspense fallback={<EntriesView clients={[]} workflowRates={[]} loading />}>
      <EntriesData />
    </Suspense>
  );
}
