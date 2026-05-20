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

// Converts a Sydney wall-clock date/time to a UTC Date, respecting AEST/AEDT automatically.
// Strategy: treat the local time as UTC to get a probe instant, format that probe back through
// the Sydney timezone to measure the actual offset, then subtract it.
function sydneyLocalToUtc(year: number, month: number, day: number, hour: number, minute: number): Date {
  const localStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
  const fmt = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
  const probe = new Date(localStr + "Z"); // treat as UTC initially
  const parts = Object.fromEntries(fmt.formatToParts(probe).map((p) => [p.type, p.value]));
  const probeLocal = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
  const diffMs = probe.getTime() - new Date(probeLocal + "Z").getTime();
  return new Date(probe.getTime() - diffMs);
}

function fridayCutoffForIsoWeek(isoWeek: string): Date {
  const monday = mondayOfIsoWeek(isoWeek);
  const fridayUtc = new Date(monday);
  fridayUtc.setUTCDate(monday.getUTCDate() + 4);
  const y = fridayUtc.getUTCFullYear();
  const m = fridayUtc.getUTCMonth() + 1;
  const d = fridayUtc.getUTCDate();
  return sydneyLocalToUtc(y, m, d, 17, 0);
}

function sundayCutoffForIsoWeek(isoWeek: string): Date {
  const monday = mondayOfIsoWeek(isoWeek);
  const sundayUtc = new Date(monday);
  sundayUtc.setUTCDate(monday.getUTCDate() + 6);
  // Monday 00:00 Sydney = the exact moment Sunday ends in that timezone.
  const mondayAfter = new Date(sundayUtc);
  mondayAfter.setUTCDate(sundayUtc.getUTCDate() + 1);
  const y = mondayAfter.getUTCFullYear();
  const m = mondayAfter.getUTCMonth() + 1;
  const d = mondayAfter.getUTCDate();
  return sydneyLocalToUtc(y, m, d, 0, 0);
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
