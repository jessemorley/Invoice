import { cacheTag } from "next/cache";
import { createServerClient } from "./supabase";
import { isoWeek } from "./format";
import type { Entry, Invoice, InvoiceDetail, Expense, DashboardData, ClientRef, MonthlyEarning, InvoiceStatus, InvoiceRef, Client, WorkflowRate } from "./types";

const CLIENT_COLOR_FALLBACK = "#9ca3af";

export const CACHE_TAGS = {
  entries: "entries",
  invoices: "invoices",
  expenses: "expenses",
  clients: "clients",
  settings: "settings",
  scheduledEmails: "scheduled-emails",
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

export async function fetchEntryById(userId: string, entryId: string): Promise<Entry | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("entries")
    .select("*, clients(id, name, billing_type, color), invoices(id, invoice_number, status)")
    .eq("user_id", userId)
    .eq("id", entryId)
    .single();

  if (error) return null;

  const client = Array.isArray(data.clients) ? data.clients[0] : data.clients;
  const inv = Array.isArray(data.invoices) ? data.invoices[0] : data.invoices;
  const invoiceRef: InvoiceRef | null = inv
    ? { id: inv.id, number: inv.invoice_number, status: inv.status as InvoiceStatus }
    : null;
  return {
    id: data.id,
    client: toClientRef(client ?? { id: data.client_id, name: "Unknown", billing_type: "day_rate" }),
    date: data.date,
    description: data.description,
    role: data.role,
    workflow_type: data.workflow_type,
    billing_type: data.billing_type_snapshot,
    day_type: data.day_type,
    hours: data.hours_worked,
    shoot_client: data.shoot_client,
    skus: data.skus,
    brand: data.brand,
    start_time: data.start_time,
    finish_time: data.finish_time,
    break_minutes: data.break_minutes,
    base_amount: data.base_amount,
    bonus_amount: data.bonus_amount,
    super_amount: data.super_amount,
    total: data.total_amount,
    invoice_id: data.invoice_id,
    invoice: invoiceRef,
    iso_week: isoWeek(data.date),
  };
}

export async function fetchEntries(userId: string, before?: string): Promise<Entry[]> {
  "use cache";
  cacheTag(CACHE_TAGS.entries);
  const supabase = createServerClient();
  const windowEnd = before ?? new Date().toISOString().slice(0, 10);
  const windowStart = (() => {
    const d = new Date(windowEnd + "T00:00:00");
    d.setMonth(d.getMonth() - 2);
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
      shoot_client: e.shoot_client,
      skus: e.skus,
      brand: e.brand,
      start_time: e.start_time,
      finish_time: e.finish_time,
      break_minutes: e.break_minutes,
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

export async function fetchInvoices(userId: string, filters: InvoiceFilters = {}): Promise<Invoice[]> {
  "use cache";
  cacheTag(CACHE_TAGS.invoices);
  const supabase = createServerClient();

  const {
    search,
    status,
    clientId,
    sortKey = "issued_date",
    sortDir = "desc",
    limit,
  } = filters;

  const from = filters.from === "all" ? undefined : filters.from;
  const to = filters.from === "all" ? undefined : filters.to;

  let query = supabase
    .from("invoices")
    .select("*, clients(id, name, billing_type, color)")
    .eq("user_id", userId);

  if (status && status !== "all") query = query.eq("status", status);
  if (clientId && clientId !== "all") query = query.eq("client_id", clientId);
  if (from) query = query.gte("issued_date", from);
  if (to) query = query.lte("issued_date", to);
  if (search) query = query.ilike("invoice_number", `%${search}%`);

  const dbSortKey = sortKey === "number" ? "invoice_number"
    : sortKey === "client" ? "client_id"
    : sortKey;

  query = query.order(dbSortKey, { ascending: sortDir === "asc" });
  if (limit !== undefined) query = query.limit(limit);

  const { data, error } = await query;
  if (error) throw new Error(`fetchInvoices: ${error.message}`);

  return (data ?? []).map((inv) => {
    const client = Array.isArray(inv.clients) ? inv.clients[0] : inv.clients;
    return {
      id: inv.id,
      number: inv.invoice_number,
      client: toClientRef(client ?? { id: inv.client_id, name: "Unknown", billing_type: "day_rate" }),
      issued_date: inv.issued_date,
      paid_date: inv.paid_date ?? null,
      subtotal: inv.subtotal,
      super_amount: inv.super_amount,
      total: inv.total,
      status: inv.status,
    };
  });
}

export type UninvoicedGroup = {
  key: string;
  clientId: string;
  clientName: string;
  clientColor: string;
  isoWeek: string;
  dateRange: string;
  entryCount: number;
  subtotal: number;
};

export async function fetchUninvoicedGroups(userId: string): Promise<UninvoicedGroup[]> {
  "use cache";
  cacheTag(CACHE_TAGS.entries);
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("entries")
    .select("id, date, base_amount, bonus_amount, clients(id, name, color)")
    .eq("user_id", userId)
    .is("invoice_id", null)
    .order("date", { ascending: false });

  if (error) throw new Error(`fetchUninvoicedGroups: ${error.message}`);

  const map = new Map<string, { clientId: string; clientName: string; clientColor: string; isoWeek: string; dates: string[]; subtotal: number }>();
  for (const e of data ?? []) {
    const client = Array.isArray(e.clients) ? e.clients[0] : e.clients;
    if (!client) continue;
    const week = isoWeek(e.date);
    const key = `${client.id}-${week}`;
    if (!map.has(key)) {
      map.set(key, { clientId: client.id, clientName: client.name, clientColor: client.color ?? CLIENT_COLOR_FALLBACK, isoWeek: week, dates: [], subtotal: 0 });
    }
    const g = map.get(key)!;
    g.dates.push(e.date);
    g.subtotal += (e.base_amount ?? 0) + (e.bonus_amount ?? 0);
  }

  return Array.from(map.entries()).map(([key, g]) => ({
    key,
    clientId: g.clientId,
    clientName: g.clientName,
    clientColor: g.clientColor,
    isoWeek: g.isoWeek,
    dateRange: computeDateRange(g.dates),
    entryCount: g.dates.length,
    subtotal: g.subtotal,
  }));
}


export async function fetchExpenses(userId: string): Promise<Expense[]> {
  "use cache";
  cacheTag(CACHE_TAGS.expenses);
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

export async function fetchClients(userId: string): Promise<{ id: string; name: string; billing_type: string; color: string | null }[]> {
  "use cache";
  cacheTag(CACHE_TAGS.clients);
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

export async function fetchFullClients(userId: string): Promise<Client[]> {
  "use cache";
  cacheTag(CACHE_TAGS.clients);
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("clients")
    .select("id, name, color, billing_type, rate_full_day, rate_half_day, rate_hourly, rate_hourly_photographer, rate_hourly_operator, pays_super, super_rate, show_super_on_invoice, invoice_frequency, address, suburb, email, abn, contact_name, notes, entry_label, show_role, is_active, created_at, default_start_time, default_finish_time, invoices(id)")
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
    show_super_on_invoice: c.show_super_on_invoice,
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
    default_start_time: c.default_start_time ?? null,
    default_finish_time: c.default_finish_time ?? null,
  }));
}

export async function fetchWorkflowRates(): Promise<WorkflowRate[]> {
  "use cache";
  cacheTag(CACHE_TAGS.clients);
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("client_workflow_rates")
    .select("id, client_id, workflow, is_flat_bonus, kpi, upper_limit_skus, incentive_rate_per_sku, max_bonus");
  if (error) throw new Error(`fetchWorkflowRates: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: r.id,
    client_id: r.client_id,
    workflow: r.workflow,
    is_flat_bonus: r.is_flat_bonus,
    kpi: r.kpi,
    upper_limit_skus: r.upper_limit_skus,
    incentive_rate_per_sku: Number(r.incentive_rate_per_sku),
    max_bonus: Number(r.max_bonus),
  }));
}

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
  suburb: string;
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

export async function fetchBusinessDetails(userId: string): Promise<BusinessDetails | null> {
  "use cache";
  cacheTag(CACHE_TAGS.settings);
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("business_details")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`fetchBusinessDetails: ${error.message}`);
  return data as BusinessDetails | null;
}

export async function fetchInvoiceDetail(invoiceId: string, userId: string): Promise<InvoiceDetail | null> {
  "use cache";
  cacheTag(CACHE_TAGS.invoices);
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("invoices")
    .select(`
      *,
      clients (id, name, color, address, suburb, email, abn, contact_name, entry_label, pays_super, super_rate, show_super_on_invoice, rate_hourly),
      entries (id, date, description, billing_type_snapshot, day_type, workflow_type, brand, shoot_client, role, skus, hours_worked, start_time, finish_time, break_minutes, base_amount, bonus_amount, super_amount, total_amount),
      invoice_line_items (id, invoice_id, description, quantity, amount, sort_order)
    `)
    .eq("id", invoiceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(`fetchInvoiceDetail: ${error.message}`);
  if (!data) return null;

  const client = Array.isArray(data.clients) ? data.clients[0] : data.clients;
  const entries = (data.entries ?? []).map((e: {
    id: string; date: string; description: string | null;
    billing_type_snapshot: string; day_type: string | null;
    workflow_type: string | null; brand: string | null;
    shoot_client: string | null; role: string | null; skus: number | null;
    hours_worked: number | null; start_time: string | null;
    finish_time: string | null; break_minutes: number | null;
    base_amount: number; bonus_amount: number; super_amount: number; total_amount: number;
  }) => ({
    id: e.id,
    date: e.date,
    description: e.description,
    billing_type: e.billing_type_snapshot as InvoiceDetail["entries"][0]["billing_type"],
    day_type: e.day_type as InvoiceDetail["entries"][0]["day_type"],
    workflow_type: e.workflow_type,
    brand: e.brand,
    shoot_client: e.shoot_client,
    role: e.role,
    skus: e.skus,
    hours_worked: e.hours_worked,
    start_time: e.start_time,
    finish_time: e.finish_time,
    break_minutes: e.break_minutes,
    base_amount: e.base_amount,
    bonus_amount: e.bonus_amount,
    super_amount: e.super_amount,
    total_amount: e.total_amount,
  }));

  const lineItems = (data.invoice_line_items ?? [])
    .sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order);

  return {
    id: data.id,
    number: data.invoice_number,
    issued_date: data.issued_date,
    due_date: data.due_date ?? null,
    status: data.status,
    subtotal: data.subtotal,
    super_amount: data.super_amount,
    total: data.total,
    notes: data.notes ?? null,
    client: {
      id: client.id,
      name: client.name,
      color: client.color ?? CLIENT_COLOR_FALLBACK,
      address: client.address,
      suburb: client.suburb,
      email: client.email,
      abn: client.abn ?? null,
      contact_name: client.contact_name ?? null,
      entry_label: client.entry_label ?? null,
      pays_super: client.pays_super,
      super_rate: client.super_rate,
      show_super_on_invoice: client.show_super_on_invoice,
      rate_hourly: client.rate_hourly ?? null,
    },
    entries,
    line_items: lineItems,
  };
}

export type ScheduledEmail = {
  id: string;
  status: "pending" | "sent" | "cancelled" | "failed";
  to_address: string;
  scheduled_for: string;
  sent_at: string | null;
  error: string | null;
};

export async function fetchScheduledEmailForInvoice(invoiceId: string, userId: string): Promise<ScheduledEmail | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("scheduled_emails")
    .select("id, status, to_address, scheduled_for, sent_at, error")
    .eq("invoice_id", invoiceId)
    .eq("user_id", userId)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`fetchScheduledEmailForInvoice: ${error.message}`);
  if (!data) return null;
  return {
    id: data.id,
    status: data.status as ScheduledEmail["status"],
    to_address: data.to_address,
    scheduled_for: data.scheduled_for,
    sent_at: data.sent_at ?? null,
    error: data.error ?? null,
  };
}

export async function fetchInvoiceSequence(userId: string): Promise<InvoiceSequence | null> {
  "use cache";
  cacheTag(CACHE_TAGS.settings);
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("invoice_sequence")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`fetchInvoiceSequence: ${error.message}`);
  return data as InvoiceSequence | null;
}
