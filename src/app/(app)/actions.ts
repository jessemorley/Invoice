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

// Returns the Monday (UTC) of the ISO week string (e.g. "2026-W21").
function mondayOfIsoWeek(isoWeek: string): Date {
  const [yearStr, weekStr] = isoWeek.split("-W");
  const year = parseInt(yearStr, 10);
  const week = parseInt(weekStr, 10);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const mondayOfWeek1 = new Date(jan4);
  mondayOfWeek1.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7));
  const monday = new Date(mondayOfWeek1);
  monday.setUTCDate(mondayOfWeek1.getUTCDate() + (week - 1) * 7);
  return monday;
}

// Friday 17:00 AEST (UTC+10) = Friday 07:00 UTC
function fridayCutoffForIsoWeek(isoWeek: string): Date {
  const monday = mondayOfIsoWeek(isoWeek);
  const friday = new Date(monday);
  friday.setUTCDate(monday.getUTCDate() + 4);
  friday.setUTCHours(7, 0, 0, 0);
  return friday;
}

// Sunday 23:59:59 AEST (UTC+10) = Sunday 13:59:59 UTC
function sundayCutoffForIsoWeek(isoWeek: string): Date {
  const monday = mondayOfIsoWeek(isoWeek);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  sunday.setUTCHours(13, 59, 59, 999);
  return sunday;
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
  const reminderEnabled = userPreferences?.weekly_invoice_reminder ?? true;
  const cutoffType = userPreferences?.weekly_invoice_reminder_cutoff ?? "friday_5pm";
  const clientMap = new Map(clients.map((c) => [c.id, c]));

  const uninvoicedCount = uninvoicedGroups.filter((g) => {
    const client = clientMap.get(g.clientId);
    if (reminderEnabled && client?.invoice_frequency === "weekly") {
      const cutoff = cutoffType === "sunday_midnight"
        ? sundayCutoffForIsoWeek(g.isoWeek)
        : fridayCutoffForIsoWeek(g.isoWeek);
      return now >= cutoff;
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
