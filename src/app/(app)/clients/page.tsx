import { Suspense } from "react";
import { fetchFullClients } from "@/lib/queries";
import { PROTOTYPE_USER_ID } from "@/lib/supabase";
import { ClientsView } from "./clients-view";

async function ClientsData() {
  const clients = await fetchFullClients(PROTOTYPE_USER_ID);
  return <ClientsView clients={clients} />;
}

export default function ClientsPage() {
  return (
    <Suspense>
      <ClientsData />
    </Suspense>
  );
}
