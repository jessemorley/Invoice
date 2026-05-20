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

// Returns the cutoff UTC instant for a given ISO week string and cutoff type.
// Uses Intl to resolve the Sydney UTC offset at the target moment, handling AEST/AEDT automatically.
function weeklyCutoff(isoWeek: string, type: "friday_5pm" | "sunday_midnight"): Date {
  const [yearStr, weekStr] = isoWeek.split("-W");
  const jan4 = new Date(Date.UTC(parseInt(yearStr, 10), 0, 4));
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7));
  // Offset from Monday: Friday = +4 days at 17:00, Sunday midnight = +7 days at 00:00
  const [dayOffset, hour] = type === "friday_5pm" ? [4, 17] : [7, 0];
  const target = new Date(week1Monday);
  target.setUTCDate(week1Monday.getUTCDate() + (parseInt(weekStr, 10) - 1) * 7 + dayOffset);
  // Probe: treat the target UTC date as a fake-UTC wall-clock time, measure the Sydney offset, subtract it.
  const localStr = `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, "0")}-${String(target.getUTCDate()).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00:00`;
  const fmt = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const probe = new Date(localStr + "Z");
  const p = Object.fromEntries(fmt.formatToParts(probe).map((x) => [x.type, x.value]));
  const diffMs = probe.getTime() - new Date(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`).getTime();
  return new Date(probe.getTime() - diffMs);
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
