export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { EntriesView } from "@/components/entries-view";
import { fetchEntries } from "@/lib/queries";
import { fetchClients } from "./actions";
import { PROTOTYPE_USER_ID } from "@/lib/supabase";

async function EntriesData() {
  const [entries, clients] = await Promise.all([
    fetchEntries(PROTOTYPE_USER_ID),
    fetchClients(),
  ]);
  return <EntriesView entries={entries} clients={clients} />;
}

export default function EntriesPage() {
  return (
    <Suspense fallback={<EntriesView clients={[]} loading />}>
      <EntriesData />
    </Suspense>
  );
}
