"use server";

import { getAuth } from "@/lib/auth";
import {
  fetchEntries,
  fetchDashboardEntries,
  fetchDashboardLineItems,
  fetchInvoices,
  fetchOutstandingInvoices,
  fetchExpenses,
  fetchDashboardData,
  fetchAllEmails,
  fetchUninvoicedGroups,
  fetchFullClients,
  fetchWorkflowRates,
  fetchUserPreferences,
  fetchTaxData,
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
  const [entries, lineItems, invoices] = await Promise.all([
    fetchDashboardEntries(userId, token),
    fetchDashboardLineItems(userId, token),
    fetchOutstandingInvoices(userId, token),
  ]);
  const data = await fetchDashboardData(userId, [...entries, ...lineItems], invoices);
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

  // hasUninvoiced is unfiltered — badge settings should not hide the generate sheet
  const hasUninvoiced = uninvoicedGroups.length > 0;

  // Suggested invoice cards: readiness is cutoff-only — the reminder toggle
  // governs badges, never readiness (see CONTEXT.md "Ready").
  const suggested = uninvoicedGroups.map((g) => {
    const client = clientMap.get(g.clientId);
    const ready =
      client?.invoice_frequency !== "weekly" ||
      cutoffType === "immediately" ||
      now >= weeklyCutoff(g.isoWeek, cutoffType);
    return { ...g, ready };
  });

  return { invoices, uninvoicedCount, hasUninvoiced, clients, suggested };
}

export async function loadClientsViewData() {
  const { userId, token } = await getAuth();
  return fetchFullClients(userId, token);
}

export async function loadExpensesViewData() {
  const { userId, token } = await getAuth();
  return fetchExpenses(userId, token);
}

export async function loadEmailsViewData() {
  const { userId, token } = await getAuth();
  return fetchAllEmails(userId, token);
}

export async function loadTaxViewData() {
  const { userId, token } = await getAuth();
  return fetchTaxData(userId, token);
}

export { fetchSettings as loadSettingsViewData };
