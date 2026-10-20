"use server";

import { getAuth } from "@/lib/auth";
import { fetchEntries, fetchFullClients, fetchWorkflowRates } from "@/lib/queries";

// SSR preload for "/" only. ViewSwitch loads views in the browser (src/lib/view-loaders.ts).
export async function loadEntriesViewData() {
  const { userId, token } = await getAuth();
  const [entries, clients, workflowRates] = await Promise.all([
    fetchEntries(userId, token),
    fetchFullClients(userId, token),
    fetchWorkflowRates(token),
  ]);
  return { entries, clients, workflowRates };
}
