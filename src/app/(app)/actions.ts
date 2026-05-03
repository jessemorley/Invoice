"use server";

import { PROTOTYPE_USER_ID } from "@/lib/supabase";
import {
  fetchEntries,
  fetchDashboardEntries,
  fetchInvoices,
  fetchExpenses,
  fetchDashboardData,
  fetchDashboardEmails,
  fetchUninvoicedGroups,
  fetchClients,
  fetchFullClients,
  fetchWorkflowRates,
} from "@/lib/queries";
import { fetchSettings } from "./settings/actions";

export async function loadEntriesViewData() {
  const [entries, clients, workflowRates] = await Promise.all([
    fetchEntries(PROTOTYPE_USER_ID),
    fetchFullClients(PROTOTYPE_USER_ID),
    fetchWorkflowRates(),
  ]);
  return { entries, clients, workflowRates };
}

export async function loadDashboardViewData() {
  const [entries, invoices, emails] = await Promise.all([
    fetchDashboardEntries(PROTOTYPE_USER_ID),
    fetchInvoices(PROTOTYPE_USER_ID, { from: "all" }),
    fetchDashboardEmails(PROTOTYPE_USER_ID),
  ]);
  const data = await fetchDashboardData(PROTOTYPE_USER_ID, entries, invoices, emails);
  return { data };
}

export async function loadInvoicesViewData() {
  const [invoices, uninvoicedGroups, clients] = await Promise.all([
    fetchInvoices(PROTOTYPE_USER_ID),
    fetchUninvoicedGroups(PROTOTYPE_USER_ID),
    fetchClients(PROTOTYPE_USER_ID),
  ]);
  return { invoices, uninvoicedCount: uninvoicedGroups.length, clients };
}

export async function loadClientsViewData() {
  return fetchFullClients(PROTOTYPE_USER_ID);
}

export async function loadExpensesViewData() {
  return fetchExpenses(PROTOTYPE_USER_ID);
}

export { fetchSettings as loadSettingsViewData };
