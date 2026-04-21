import { fetchClients } from "@/lib/queries";
import { PROTOTYPE_USER_ID } from "@/lib/supabase";
import { ClientsView } from "./clients-view";

export default async function ClientsPage() {
  const clients = await fetchClients(PROTOTYPE_USER_ID);
  return <ClientsView clients={clients} />;
}
