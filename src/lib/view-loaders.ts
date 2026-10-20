// Browser-side view loaders for ViewSwitch: read straight from Supabase with
// the user's session instead of going through a server action.
import { createBrowserSupabase } from "./supabase";
import { todayInSydney } from "./format";
import {
  readEntries,
  readDashboardEntries,
  readDashboardLineItems,
  readOutstandingInvoices,
  readInvoices,
  readUninvoicedGroups,
  readFullClients,
  readWorkflowRates,
  readExpenses,
  readAllEmails,
  readTaxRows,
  readBusinessDetails,
  readInvoiceSequence,
  readUserPreferences,
  buildDashboardData,
  buildInvoicesView,
  buildTaxTotals,
} from "./reads";

// getSession() reads the cookie locally — no network round trip. RLS enforces
// access either way; userId only scopes the queries as the server did.
async function auth() {
  const supabase = createBrowserSupabase();
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Unauthenticated");
  return { supabase, userId: data.session.user.id };
}

export async function loadEntriesViewData() {
  const { supabase, userId } = await auth();
  const [entries, clients, workflowRates] = await Promise.all([
    readEntries(supabase, userId),
    readFullClients(supabase, userId),
    readWorkflowRates(supabase),
  ]);
  return { entries, clients, workflowRates };
}

export async function loadDashboardViewData() {
  const { supabase, userId } = await auth();
  const [entries, lineItems, invoices] = await Promise.all([
    readDashboardEntries(supabase, userId),
    readDashboardLineItems(supabase, userId),
    readOutstandingInvoices(supabase, userId),
  ]);
  return { data: buildDashboardData([...entries, ...lineItems], invoices, todayInSydney()) };
}

export async function loadInvoicesViewData() {
  const { supabase, userId } = await auth();
  const [invoices, uninvoicedGroups, clients, userPreferences] = await Promise.all([
    readInvoices(supabase, userId),
    readUninvoicedGroups(supabase, userId),
    readFullClients(supabase, userId),
    readUserPreferences(supabase, userId),
  ]);
  return { invoices, clients, ...buildInvoicesView(uninvoicedGroups, clients, userPreferences, new Date()) };
}

export async function loadClientsViewData() {
  const { supabase, userId } = await auth();
  return readFullClients(supabase, userId);
}

export async function loadExpensesViewData() {
  const { supabase, userId } = await auth();
  return readExpenses(supabase, userId);
}

export async function loadEmailsViewData() {
  const { supabase, userId } = await auth();
  return readAllEmails(supabase, userId);
}

export async function loadTaxViewData() {
  const { supabase, userId } = await auth();
  return buildTaxTotals(await readTaxRows(supabase, userId), todayInSydney());
}

export async function loadSettingsViewData() {
  const { supabase, userId } = await auth();
  const [businessDetails, invoiceSequence, userPreferences] = await Promise.all([
    readBusinessDetails(supabase, userId),
    readInvoiceSequence(supabase, userId),
    readUserPreferences(supabase, userId),
  ]);
  return { businessDetails, invoiceSequence, userPreferences };
}
