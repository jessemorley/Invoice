"use server";

import { getAuth } from "@/lib/auth";
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
  const { userId, token } = await getAuth();
  const [entries, clients, workflowRates] = await Promise.all([
    fetchEntries(userId, token),
    fetchFullClients(userId, token),
    fetchWorkflowRates(token),
  ]);
  return { entries, clients, workflowRates };
}

export async function loadDashboardViewData() {
  const { userId, token } = await getAuth();
  const [entries, invoices, emails] = await Promise.all([
    fetchDashboardEntries(userId, token),
    fetchInvoices(userId, token, { from: "all" }),
    fetchDashboardEmails(userId, token),
  ]);
  const data = await fetchDashboardData(userId, entries, invoices, emails);
  return { data };
}

export async function loadInvoicesViewData() {
  const { userId, token } = await getAuth();
  const [invoices, uninvoicedGroups, clients] = await Promise.all([
    fetchInvoices(userId, token),
    fetchUninvoicedGroups(userId, token),
    fetchClients(userId, token),
  ]);
  return { invoices, uninvoicedCount: uninvoicedGroups.length, clients };
}

export async function loadClientsViewData() {
  const { userId, token } = await getAuth();
  return fetchFullClients(userId, token);
}

export async function loadExpensesViewData() {
  const { userId, token } = await getAuth();
  return fetchExpenses(userId, token);
}

export { fetchSettings as loadSettingsViewData };
