import { unstable_cache } from "next/cache";
import { createServerClient } from "./supabase";
import { isoWeek } from "./format";
import type { Entry, Invoice, Expense, DashboardData, ClientRef, MonthlyEarning, InvoiceStatus, InvoiceRef, Client } from "./types";

const CLIENT_COLOR_FALLBACK = "#9ca3af";

// Cache tags — import these in server actions to call revalidateTag
export const CACHE_TAGS = {
  entries: "entries",
  invoices: "invoices",
  expenses: "expenses",
  clients: "clients",
  uninvoicedCount: "uninvoiced-count",
  settings: "settings",
} as const;

function toClientRef(client: { id: string; name: string; billing_type: string; color?: string | null }): ClientRef {
  return {
    id: client.id,
    name: client.name,
    color: client.color ?? CLIENT_COLOR_FALLBACK,
    billing_type: client.billing_type as ClientRef["billing_type"],
  };
}

function computeDateRange(dates: string[]): string {
  if (dates.length === 0) return "";
  const sorted = [...dates].sort();
  const first = new Date(sorted[0] + "T00:00:00");
  const last = new Date(sorted[sorted.length - 1] + "T00:00:00");
  const firstDay = first.getDate();
  const lastDay = last.getDate();
  const firstMonth = first.toLocaleDateString("en-AU", { month: "short" });
  const lastMonth = last.toLocaleDateString("en-AU", { month: "short" });
  if (sorted[0] === sorted[sorted.length - 1]) return `${firstDay} ${firstMonth}`;
  if (first.getMonth() === last.getMonth()) return `${firstDay}–${lastDay} ${firstMonth}`;
  return `${firstDay} ${firstMonth} – ${lastDay} ${lastMonth}`;
}

async function _fetchEntries(userId: string, before?: string): Promise<Entry[]> {
  const supabase = createServerClient();
  const windowEnd = before ?? "9999-12-31";
  const windowStart = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 28);
    return d.toISOString().slice(0, 10);
  })();

  const { data, error } = await supabase
    .from("entries")
    .select("*, clients(id, name, billing_type, color), invoices(id, invoice_number, status)")
    .eq("user_id", userId)
    .gte("date", windowStart)
    .lte("date", windowEnd)
    .order("date", { ascending: false });

  if (error) throw new Error(`fetchEntries: ${error.message}`);

  return (data ?? []).map((e) => {
    const client = Array.isArray(e.clients) ? e.clients[0] : e.clients;
    const inv = Array.isArray(e.invoices) ? e.invoices[0] : e.invoices;
    const invoiceRef: InvoiceRef | null = inv
      ? { id: inv.id, number: inv.invoice_number, status: inv.status as InvoiceStatus }
      : null;
    return {
      id: e.id,
      client: toClientRef(client ?? { id: e.client_id, name: "Unknown", billing_type: "day_rate" }),
      date: e.date,
      description: e.description,
      role: e.role,
      workflow_type: e.workflow_type,
      billing_type: e.billing_type_snapshot,
      day_type: e.day_type,
      hours: e.hours_worked,
      base_amount: e.base_amount,
      bonus_amount: e.bonus_amount,
      super_amount: e.super_amount,
      total: e.total_amount,
      invoice_id: e.invoice_id,
      invoice: invoiceRef,
      iso_week: isoWeek(e.date),
    };
  });
}

export const fetchEntries = unstable_cache(
  _fetchEntries,
  [CACHE_TAGS.entries],
  { tags: [CACHE_TAGS.entries] }
);


export type InvoiceFilters = {
  search?: string;
  status?: InvoiceStatus | "all";
  clientId?: string;
  from?: string;
  to?: string;
  sortKey?: "issued_date" | "total" | "number" | "client" | "status";
  sortDir?: "asc" | "desc";
  limit?: number;
};

async function _fetchInvoices(userId: string, filters: InvoiceFilters = {}): Promise<Invoice[]> {
  const supabase = createServerClient();

  const {
    search,
    status,
    clientId,
    sortKey = "issued_date",
    sortDir = "desc",
    limit = 25,
  } = filters;

  const from = filters.from === "all" ? undefined : filters.from;
  const to = filters.from === "all" ? undefined : filters.to;

  let query = supabase
    .from("invoices")
    .select("*, clients(id, name, billing_type, color), entries(date)")
    .eq("user_id", userId);

  if (status && status !== "all") query = query.eq("status", status);
  if (clientId && clientId !== "all") query = query.eq("client_id", clientId);
  if (from) query = query.gte("issued_date", from);
  if (to) query = query.lte("issued_date", to);
  if (search) query = query.ilike("invoice_number", `%${search}%`);

  const dbSortKey = sortKey === "number" ? "invoice_number"
    : sortKey === "client" ? "client_id"
    : sortKey;

  query = query.order(dbSortKey, { ascending: sortDir === "asc" }).limit(limit);

  const { data, error } = await query;
  if (error) throw new Error(`fetchInvoices: ${error.message}`);

  return (data ?? []).map((inv) => {
    const client = Array.isArray(inv.clients) ? inv.clients[0] : inv.clients;
    const dates = (inv.entries ?? []).map((e: { date: string }) => e.date);
    return {
      id: inv.id,
      number: inv.invoice_number,
      client: toClientRef(client ?? { id: inv.client_id, name: "Unknown", billing_type: "day_rate" }),
      issued_date: inv.issued_date,
      date_range: computeDateRange(dates),
      subtotal: inv.subtotal,
      super_amount: inv.super_amount,
      total: inv.total,
      status: inv.status,
      entry_count: dates.length,
    };
  });
}

export const fetchInvoices = unstable_cache(
  _fetchInvoices,
  [CACHE_TAGS.invoices],
  { tags: [CACHE_TAGS.invoices] }
);

async function _fetchUninvoicedCount(userId: string): Promise<number> {
  const supabase = createServerClient();
  const { data, error } = await supabase.rpc("uninvoiced_group_count", { p_user_id: userId });
  if (error) throw new Error(`fetchUninvoicedCount: ${error.message}`);
  return data ?? 0;
}

export const fetchUninvoicedCount = unstable_cache(
  _fetchUninvoicedCount,
  [CACHE_TAGS.uninvoicedCount],
  { tags: [CACHE_TAGS.uninvoicedCount] }
);

async function _fetchExpenses(userId: string): Promise<Expense[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: false });

  if (error) throw new Error(`fetchExpenses: ${error.message}`);

  return (data ?? []).map((e) => ({
    id: e.id,
    date: e.date,
    category: e.category,
    description: e.description,
    amount: e.amount,
    gst_included: e.gst_included,
    notes: e.notes,
    receipt_path: e.receipt_path,
    is_billable: e.is_billable,
    invoice_id: e.invoice_id,
  }));
}

export const fetchExpenses = unstable_cache(
  _fetchExpenses,
  [CACHE_TAGS.expenses],
  { tags: [CACHE_TAGS.expenses] }
);

async function _fetchClients(userId: string): Promise<{ id: string; name: string; billing_type: string; color: string | null }[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("clients")
    .select("id, name, billing_type, color")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("name");

  if (error) throw new Error(`fetchClients: ${error.message}`);
  return (data ?? []).map((c) => ({ ...c, color: c.color ?? null }));
}

export const fetchClients = unstable_cache(
  _fetchClients,
  [CACHE_TAGS.clients],
  { tags: [CACHE_TAGS.clients] }
);

async function _fetchFullClients(userId: string): Promise<Client[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("clients")
    .select("id, name, color, billing_type, rate_full_day, rate_half_day, rate_hourly, rate_hourly_photographer, rate_hourly_operator, pays_super, super_rate, invoice_frequency, address, suburb, email, abn, contact_name, notes, entry_label, show_role, is_active, created_at, invoices(id)")
    .eq("user_id", userId)
    .order("name");

  if (error) throw new Error(`fetchFullClients: ${error.message}`);
  return (data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    color: c.color ?? null,
    billing_type: c.billing_type,
    rate_full_day: c.rate_full_day ?? null,
    rate_half_day: c.rate_half_day ?? null,
    rate_hourly: c.rate_hourly ?? null,
    rate_hourly_photographer: c.rate_hourly_photographer ?? null,
    rate_hourly_operator: c.rate_hourly_operator ?? null,
    pays_super: c.pays_super,
    super_rate: Number(c.super_rate),
    invoice_frequency: c.invoice_frequency,
    address: c.address,
    suburb: c.suburb,
    email: c.email,
    abn: c.abn ?? null,
    contact_name: c.contact_name ?? null,
    notes: c.notes ?? null,
    entry_label: c.entry_label ?? null,
    show_role: c.show_role,
    is_active: c.is_active,
    created_at: c.created_at,
    invoice_count: Array.isArray(c.invoices) ? c.invoices.length : 0,
  }));
}

export const fetchFullClients = unstable_cache(
  _fetchFullClients,
  [CACHE_TAGS.clients],
  { tags: [CACHE_TAGS.clients] }
);

export async function fetchDashboardData(userId: string, entries: Entry[], invoices: Invoice[]): Promise<DashboardData> {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const mtdEarnings = entries
    .filter((e) => {
      const d = new Date(e.date + "T00:00:00");
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    })
    .reduce((sum, e) => sum + e.base_amount + e.bonus_amount, 0);

  const priorMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const priorMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
  const priorMonthDayOfMonth = now.getDate();

  const mtdPriorMonth = entries
    .filter((e) => {
      const d = new Date(e.date + "T00:00:00");
      return (
        d.getFullYear() === priorMonthYear &&
        d.getMonth() === priorMonth &&
        d.getDate() <= priorMonthDayOfMonth
      );
    })
    .reduce((sum, e) => sum + e.base_amount + e.bonus_amount, 0);

  const outstanding = invoices.filter(
    (inv) => inv.status === "draft" || inv.status === "issued"
  );

  // Build 6-month earnings chart: current 6 months vs same 6 months prior year
  const monthlyEarnings: MonthlyEarning[] = [];
  for (let i = 5; i >= 0; i--) {
    const monthDate = new Date(currentYear, currentMonth - i, 1);
    const yr = monthDate.getFullYear();
    const mo = monthDate.getMonth();
    const label = monthDate.toLocaleDateString("en-AU", { month: "short" });

    const current = entries
      .filter((e) => {
        const d = new Date(e.date + "T00:00:00");
        return d.getFullYear() === yr && d.getMonth() === mo;
      })
      .reduce((sum, e) => sum + e.base_amount + e.bonus_amount, 0);

    const prior = entries
      .filter((e) => {
        const d = new Date(e.date + "T00:00:00");
        return d.getFullYear() === yr - 1 && d.getMonth() === mo;
      })
      .reduce((sum, e) => sum + e.base_amount + e.bonus_amount, 0);

    monthlyEarnings.push({ month: label, current, prior });
  }

  return { mtdEarnings, mtdPriorMonth, outstanding, monthlyEarnings };
}

export type BusinessDetails = {
  id: string;
  user_id: string;
  name: string;
  business_name: string;
  abn: string;
  address: string;
  email: string;
  super_fund: string;
  super_fund_abn: string;
  super_usi: string;
  super_member_number: string;
  bsb: string;
  account_number: string;
  include_super_in_totals: boolean;
};

export type InvoiceSequence = {
  id: string;
  user_id: string;
  invoice_prefix: string;
  last_number: number;
  due_date_offset: number;
  mark_as_issued_on_send: boolean;
};

async function _fetchBusinessDetails(userId: string): Promise<BusinessDetails | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("business_details")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`fetchBusinessDetails: ${error.message}`);
  return data as BusinessDetails | null;
}

export const fetchBusinessDetails = unstable_cache(
  _fetchBusinessDetails,
  [CACHE_TAGS.settings],
  { tags: [CACHE_TAGS.settings] }
);

async function _fetchInvoiceSequence(userId: string): Promise<InvoiceSequence | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("invoice_sequence")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`fetchInvoiceSequence: ${error.message}`);
  return data as InvoiceSequence | null;
}

export const fetchInvoiceSequence = unstable_cache(
  _fetchInvoiceSequence,
  [CACHE_TAGS.settings],
  { tags: [CACHE_TAGS.settings] }
);
