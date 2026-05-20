"use server";

import { getAuth } from "@/lib/auth";
import {
  fetchEntries,
  fetchDashboardEntries,
  fetchInvoices,
  fetchOutstandingInvoices,
  fetchExpenses,
  fetchDashboardData,
  fetchDashboardEmails,
  fetchUninvoicedGroups,
  fetchFullClients,
  fetchWorkflowRates,
  fetchUserPreferences,
} from "@/lib/queries";
import { weeklyCutoff } from "@/lib/format";
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
    fetchOutstandingInvoices(userId, token),
    fetchDashboardEmails(userId, token),
  ]);
  const data = await fetchDashboardData(userId, entries, invoices, emails);
  return { data };
}

export async function loadInvoicesViewData() {
  const { userId, token } = await getAuth();
  const [invoices, uninvoicedGroups, clients, userPreferences] = await Promise.all([
    fetchInvoices(userId, token),
    fetchUninvoicedGroups(userId, token),
    fetchFullClients(userId, token),
    fetchUserPreferences(userId, token),
  ]);

  const now = new Date();
  const badgeEnabled = userPreferences?.weekly_invoice_reminder ?? true;
  const cutoffType = userPreferences?.weekly_invoice_reminder_cutoff ?? "immediately";
  const clientMap = new Map(clients.map((c) => [c.id, c]));

  const uninvoicedCount = uninvoicedGroups.filter((g) => {
    const client = clientMap.get(g.clientId);
    if (client?.invoice_frequency === "weekly") {
      if (!badgeEnabled) return false;
      if (cutoffType === "immediately") return true;
      return now >= weeklyCutoff(g.isoWeek, cutoffType);
    }
    return true;
  }).length;

  return { invoices, uninvoicedCount, clients };
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
