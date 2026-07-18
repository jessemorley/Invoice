import { cacheTag } from "next/cache";
import { createTokenClient } from "./supabase";
import { isoWeek, todayInSydney, fyStartYear } from "./format";
import { lineItemTotal } from "./utils";
import type { Entry, Invoice, InvoiceDetail, InvoiceEntry, Expense, ExpenseCategory, DashboardData, DashboardEmail, ClientRef, WeeklyEarning, MtdDailyPoint, InvoiceStatus, InvoiceRef, Client, WorkflowRate, CalendarDay } from "./types";

const CLIENT_COLOR_FALLBACK = "#9ca3af";

export const CACHE_TAGS = {
  entries: "entries",
  invoices: "invoices",
  expenses: "expenses",
  clients: "clients",
  settings: "settings",
  scheduledEmails: "scheduled-emails",
  payg: "payg",
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

export async function fetchEntryById(userId: string, entryId: string, token: string): Promise<Entry | null> {
  const supabase = createTokenClient(token);
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
    label: data.label,
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

export async function fetchEntries(userId: string, token: string, before?: string): Promise<Entry[]> {
  "use cache";
  cacheTag(CACHE_TAGS.entries);
  const supabase = createTokenClient(token);
  const anchor = before ?? new Date().toISOString().slice(0, 10);
  const windowStart = (() => {
    const d = new Date(anchor + "T00:00:00");
    d.setMonth(d.getMonth() - 2);
    return d.toISOString().slice(0, 10);
  })();

  let query = supabase
    .from("entries")
    .select("*, clients(id, name, billing_type, color), invoices(id, invoice_number, status)")
    .eq("user_id", userId)
    .gte("date", windowStart)
    .order("date", { ascending: false });

  // Only cap at `before` when paginating backward; on initial load include all dates
  // (including future-dated entries and today in non-UTC timezones)
  if (before) query = query.lte("date", before);

  const { data, error } = await query;

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
      label: e.label,
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

type DashboardEntry = {
  date: string;
  base_amount: number;
  bonus_amount: number;
  client: { name: string; color: string } | null;
  // Line items only: true when the parent invoice also has entries. Earnings
  // still count these dollars; the calendar skips them (the entries' own days
  // already mark the work).
  invoiceHasEntries?: boolean;
};

// Start of the 24-month lookback window shared by the dashboard queries (YYYY-MM-DD).
function dashboardWindowStart(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 24);
  return d.toISOString().slice(0, 10);
}

export async function fetchDashboardEntries(userId: string, token: string): Promise<DashboardEntry[]> {
  "use cache";
  cacheTag(CACHE_TAGS.entries);
  const supabase = createTokenClient(token);
  const windowStart = dashboardWindowStart();

  const { data, error } = await supabase
    .from("entries")
    .select("date, base_amount, bonus_amount, clients(name, color)")
    .eq("user_id", userId)
    .gte("date", windowStart);

  if (error) throw new Error(`fetchDashboardEntries: ${error.message}`);

  return (data ?? []).map((e) => {
    const client = Array.isArray(e.clients) ? e.clients[0] : e.clients;
    return {
      date: e.date,
      base_amount: e.base_amount,
      bonus_amount: e.bonus_amount,
      client: client ? { name: client.name, color: client.color ?? CLIENT_COLOR_FALLBACK } : null,
    };
  });
}

export async function fetchDashboardLineItems(userId: string, token: string): Promise<DashboardEntry[]> {
  "use cache";
  cacheTag(CACHE_TAGS.invoices);
  const supabase = createTokenClient(token);
  const windowStart = dashboardWindowStart();

  const { data, error } = await supabase
    .from("invoice_line_items")
    .select("amount, quantity, invoices!inner(issued_date, status, clients(name, color), entries(count))")
    .eq("user_id", userId)
    .in("invoices.status", ["issued", "paid"])
    .gte("invoices.issued_date", windowStart);

  if (error) throw new Error(`fetchDashboardLineItems: ${error.message}`);

  return (data ?? []).flatMap((row) => {
    const inv = Array.isArray(row.invoices) ? row.invoices[0] : row.invoices;
    // The gte filter above excludes null issued_date, but don't rely on it.
    if (!inv?.issued_date) return [];
    const client = Array.isArray(inv.clients) ? inv.clients[0] : inv.clients;
    const entriesCount = Array.isArray(inv.entries) ? inv.entries[0] : inv.entries;
    return {
      date: inv.issued_date,
      base_amount: lineItemTotal(row),
      bonus_amount: 0,
      client: client ? { name: client.name, color: client.color ?? CLIENT_COLOR_FALLBACK } : null,
      invoiceHasEntries: (entriesCount?.count ?? 0) > 0,
    };
  });
}

export async function fetchOutstandingInvoices(userId: string, token: string): Promise<Invoice[]> {
  "use cache";
  cacheTag(CACHE_TAGS.invoices);
  const supabase = createTokenClient(token);

  const { data, error } = await supabase
    .from("invoices")
    .select("id, invoice_number, issued_date, due_date, paid_date, subtotal, super_amount, total, status, clients(id, name, billing_type, color)")
    .eq("user_id", userId)
    .in("status", ["draft", "issued"]);

  if (error) throw new Error(`fetchOutstandingInvoices: ${error.message}`);

  return (data ?? []).map((inv) => {
    const client = Array.isArray(inv.clients) ? inv.clients[0] : inv.clients;
    return {
      id: inv.id,
      number: inv.invoice_number,
      client: toClientRef(client ?? { id: "", name: "Unknown", billing_type: "day_rate" }),
      issued_date: inv.issued_date,
      due_date: inv.due_date ?? null,
      paid_date: inv.paid_date ?? null,
      subtotal: inv.subtotal,
      super_amount: inv.super_amount,
      total: inv.total,
      status: inv.status as InvoiceStatus,
      email: null,
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

export async function fetchInvoices(userId: string, token: string, filters: InvoiceFilters = {}): Promise<Invoice[]> {
  "use cache";
  cacheTag(CACHE_TAGS.invoices);
  const supabase = createTokenClient(token);

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
    .select("*, clients(id, name, billing_type, color), scheduled_emails(status, scheduled_for, sent_at)")
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
    const emails = (Array.isArray(inv.scheduled_emails) ? inv.scheduled_emails : inv.scheduled_emails ? [inv.scheduled_emails] : []) as Array<{ status: string; scheduled_for: string; sent_at: string | null }>;
    const activeEmail = emails
      .filter((e) => e.status !== "cancelled")
      .sort((a, b) => b.scheduled_for.localeCompare(a.scheduled_for))[0] ?? null;
    return {
      id: inv.id,
      number: inv.invoice_number,
      client: toClientRef(client ?? { id: inv.client_id, name: "Unknown", billing_type: "day_rate" }),
      issued_date: inv.issued_date,
      due_date: inv.due_date ?? null,
      paid_date: inv.paid_date ?? null,
      subtotal: inv.subtotal,
      super_amount: inv.super_amount,
      total: inv.total,
      status: inv.status,
      email: activeEmail ? {
        status: activeEmail.status as "pending" | "sent" | "failed",
        scheduled_for: activeEmail.scheduled_for,
        sent_at: activeEmail.sent_at,
      } : null,
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

export async function fetchUninvoicedGroups(userId: string, token: string): Promise<UninvoicedGroup[]> {
  "use cache";
  cacheTag(CACHE_TAGS.entries);
  const supabase = createTokenClient(token);
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


// A suggested invoice is an uninvoiced group plus readiness (see CONTEXT.md):
// ready = the client's invoicing cutoff has passed, independent of reminder prefs.
export type SuggestedInvoice = UninvoicedGroup & { ready: boolean };

export async function fetchSuggestedInvoiceEntries(
  userId: string,
  token: string,
  clientId: string,
  week: string
): Promise<InvoiceEntry[]> {
  "use cache";
  cacheTag(CACHE_TAGS.entries);
  const supabase = createTokenClient(token);
  const { data, error } = await supabase
    .from("entries")
    .select("id, date, description, billing_type_snapshot, day_type, workflow_type, brand, label, role, skus, hours_worked, start_time, finish_time, break_minutes, base_amount, bonus_amount, super_amount, total_amount")
    .eq("user_id", userId)
    .eq("client_id", clientId)
    .is("invoice_id", null)
    .order("date", { ascending: true });

  if (error) throw new Error(`fetchSuggestedInvoiceEntries: ${error.message}`);

  return (data ?? [])
    .filter((e) => isoWeek(e.date) === week)
    .map((e) => ({
      id: e.id,
      date: e.date,
      description: e.description,
      billing_type: e.billing_type_snapshot as InvoiceEntry["billing_type"],
      day_type: e.day_type as InvoiceEntry["day_type"],
      workflow_type: e.workflow_type,
      brand: e.brand,
      label: e.label,
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
}

export async function fetchExpenses(userId: string, token: string): Promise<Expense[]> {
  "use cache";
  cacheTag(CACHE_TAGS.expenses);
  const supabase = createTokenClient(token);
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

export type TaxClientIncome = { client: ClientRef; income: number };

export type PaygInstalment = { id: string; paid_date: string; amount: number; label: string | null };

export type TaxMonthTotals = { month: string; revenue: number; expenses: number };

export type TaxFyTotals = {
  startYear: number;
  income: number;
  expenditure: number;
  expenditureByCategory: Partial<Record<ExpenseCategory, number>>;
  incomeByClient: TaxClientIncome[];
  monthly: TaxMonthTotals[];
  paygInstalments: PaygInstalment[];
  paygPaid: number;
};

// Australian FY runs Jul→Jun; chart shows all 12 months in that order.
const FY_MONTH_LABELS = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"];
const fyMonthIndex = (date: Date) => (date.getMonth() + 6) % 12;

export async function fetchTaxData(userId: string, token: string): Promise<TaxFyTotals[]> {
  "use cache";
  cacheTag(CACHE_TAGS.invoices);
  cacheTag(CACHE_TAGS.expenses);
  cacheTag(CACHE_TAGS.payg);
  const supabase = createTokenClient(token);

  const [invoicesRes, expensesRes, paygRes] = await Promise.all([
    supabase.from("invoices").select("paid_date, total, clients(id, name, billing_type, color)").eq("user_id", userId).not("paid_date", "is", null),
    supabase.from("expenses").select("date, amount, category").eq("user_id", userId),
    supabase.from("payg_instalments").select("id, paid_date, amount, label").eq("user_id", userId),
  ]);
  if (invoicesRes.error) throw new Error(`fetchTaxData: ${invoicesRes.error.message}`);
  if (expensesRes.error) throw new Error(`fetchTaxData: ${expensesRes.error.message}`);
  if (paygRes.error) throw new Error(`fetchTaxData: ${paygRes.error.message}`);

  const byFy = new Map<number, TaxFyTotals & { incomeByClientId: Map<string, TaxClientIncome> }>();
  const get = (startYear: number) => {
    let fy = byFy.get(startYear);
    if (!fy) {
      fy = { startYear, income: 0, expenditure: 0, expenditureByCategory: {}, incomeByClient: [], incomeByClientId: new Map(), monthly: FY_MONTH_LABELS.map((month) => ({ month, revenue: 0, expenses: 0 })), paygInstalments: [], paygPaid: 0 };
      byFy.set(startYear, fy);
    }
    return fy;
  };

  for (const inv of invoicesRes.data ?? []) {
    const date = new Date(inv.paid_date + "T00:00:00");
    const fy = get(fyStartYear(date));
    fy.income += inv.total;
    fy.monthly[fyMonthIndex(date)].revenue += inv.total;
    const client = Array.isArray(inv.clients) ? inv.clients[0] : inv.clients;
    if (client) {
      const ref = toClientRef(client);
      const existing = fy.incomeByClientId.get(ref.id);
      if (existing) existing.income += inv.total;
      else fy.incomeByClientId.set(ref.id, { client: ref, income: inv.total });
    }
  }
  for (const exp of expensesRes.data ?? []) {
    const date = new Date(exp.date + "T00:00:00");
    const fy = get(fyStartYear(date));
    fy.expenditure += exp.amount;
    fy.monthly[fyMonthIndex(date)].expenses += exp.amount;
    fy.expenditureByCategory[exp.category] = (fy.expenditureByCategory[exp.category] ?? 0) + exp.amount;
  }
  for (const p of paygRes.data ?? []) {
    const fy = get(fyStartYear(new Date(p.paid_date + "T00:00:00")));
    fy.paygInstalments.push({ id: p.id, paid_date: p.paid_date, amount: p.amount, label: p.label });
    fy.paygPaid += p.amount;
  }

  return Array.from(byFy.values())
    .map((fy) => ({
      ...fy,
      incomeByClient: Array.from(fy.incomeByClientId.values()).sort((a, b) => b.income - a.income),
      paygInstalments: fy.paygInstalments.sort((a, b) => a.paid_date.localeCompare(b.paid_date)),
    }))
    .sort((a, b) => b.startYear - a.startYear);
}

export async function fetchClients(userId: string, token: string): Promise<{ id: string; name: string; billing_type: string; color: string | null }[]> {
  "use cache";
  cacheTag(CACHE_TAGS.clients);
  const supabase = createTokenClient(token);
  const { data, error } = await supabase
    .from("clients")
    .select("id, name, billing_type, color")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("name");

  if (error) throw new Error(`fetchClients: ${error.message}`);
  return (data ?? []).map((c) => ({ ...c, color: c.color ?? null }));
}

export async function fetchFullClients(userId: string, token: string): Promise<Client[]> {
  "use cache";
  cacheTag(CACHE_TAGS.clients);
  const supabase = createTokenClient(token);
  const { data, error } = await supabase
    .from("clients")
    .select("id, name, color, billing_type, rate_full_day, rate_half_day, rate_hourly, pays_super, super_rate, show_super_on_invoice, invoice_frequency, address, suburb, email, abn, contact_name, notes, entry_label, is_active, created_at, default_start_time, default_finish_time, invoices(id), client_roles(id, client_id, name, rate)")
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
    is_active: c.is_active,
    created_at: c.created_at,
    invoice_count: Array.isArray(c.invoices) ? c.invoices.length : 0,
    default_start_time: c.default_start_time ?? null,
    default_finish_time: c.default_finish_time ?? null,
    roles: Array.isArray(c.client_roles) ? c.client_roles.map((r) => ({
      id: r.id,
      client_id: r.client_id,
      name: r.name,
      rate: Number(r.rate),
    })) : [],
  }));
}

export async function fetchWorkflowRates(token: string): Promise<WorkflowRate[]> {
  "use cache";
  cacheTag(CACHE_TAGS.clients);
  const supabase = createTokenClient(token);
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

export async function fetchAllEmails(userId: string, token: string): Promise<DashboardEmail[]> {
  "use cache";
  cacheTag(CACHE_TAGS.scheduledEmails);
  const supabase = createTokenClient(token);
  const { data, error } = await supabase
    .from("scheduled_emails")
    .select("id, invoice_id, to_address, subject, body_text, filename, scheduled_for, sent_at, sent_pdf_path, status, invoices(invoice_number, status, clients(name, color))")
    .eq("user_id", userId)
    .in("status", ["pending", "failed", "sent"])
    .order("status", { ascending: true })
    .order("sent_at", { ascending: false });

  if (error) throw new Error(`fetchAllEmails: ${error.message}`);

  const scheduled: DashboardEmail[] = [];
  const recent: DashboardEmail[] = [];

  for (const row of data ?? []) {
    const inv = Array.isArray(row.invoices) ? row.invoices[0] : row.invoices;
    const client = inv && (Array.isArray(inv.clients) ? inv.clients[0] : inv.clients);
    const email: DashboardEmail = {
      id: row.id,
      invoice_id: row.invoice_id ?? "",
      invoice_number: inv?.invoice_number ?? "",
      invoice_status: (inv?.status ?? "draft") as DashboardEmail["invoice_status"],
      client_name: client?.name ?? null,
      client_color: client?.color ?? null,
      to_address: row.to_address,
      subject: row.subject,
      body_text: row.body_text,
      filename: row.filename,
      scheduled_for: row.scheduled_for,
      sent_at: row.sent_at ?? null,
      sent_pdf_path: row.sent_pdf_path ?? null,
      status: row.status as DashboardEmail["status"],
    };
    if (row.status === "pending" || row.status === "failed") {
      scheduled.push(email);
    } else {
      recent.push(email);
    }
  }

  scheduled.sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for));
  return [...scheduled, ...recent];
}

export async function fetchDashboardEmails(userId: string, token: string): Promise<DashboardEmail[]> {
  const emails = await fetchAllEmails(userId, token);
  return emails.slice(0, 4);
}

export async function fetchDashboardData(userId: string, entries: DashboardEntry[], invoices: Invoice[], emails: DashboardEmail[]): Promise<DashboardData> {
  const todayStr = todayInSydney(); // YYYY-MM-DD in Sydney time
  const [currentYear, currentMonth0, todayDay] = todayStr.split("-").map(Number);
  const currentMonth = currentMonth0 - 1; // 0-indexed to match Date.getMonth()

  const currentMonthPrefix = `${currentYear}-${String(currentMonth0).padStart(2, "0")}`;
  const mtdEarnings = entries
    .filter((e) => e.date <= todayStr && e.date.startsWith(currentMonthPrefix))
    .reduce((sum, e) => sum + e.base_amount + e.bonus_amount, 0);

  const priorMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const priorMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
  const priorMonthDayOfMonth = todayDay;

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

  // Build 52-week earnings chart: previous 52 complete ISO weeks vs same weeks prior year.
  // Prior-year equivalent = shift back exactly 52 weeks (same ISO week number, one year prior).
  const weeklyEarnings: WeeklyEarning[] = [];

  const weekTotals = new Map<string, number>();
  for (const e of entries) {
    const key = isoWeek(e.date);
    weekTotals.set(key, (weekTotals.get(key) ?? 0) + e.base_amount + e.bonus_amount);
  }

  // Walk back 52 complete weeks from the start of the current (possibly incomplete) ISO week.
  const now = new Date(todayStr + "T00:00:00");
  const todayDow = now.getDay() || 7;
  const thisWeekMonday = new Date(now);
  thisWeekMonday.setDate(now.getDate() - (todayDow - 1));
  thisWeekMonday.setHours(0, 0, 0, 0);

  for (let i = 52; i >= 1; i--) {
    const weekStart = new Date(thisWeekMonday);
    weekStart.setDate(thisWeekMonday.getDate() - i * 7);
    const key = isoWeek(weekStart.toISOString().slice(0, 10));

    const priorStart = new Date(weekStart);
    priorStart.setDate(weekStart.getDate() - 52 * 7);
    const priorKey = isoWeek(priorStart.toISOString().slice(0, 10));

    const label = weekStart.toLocaleDateString("en-AU", { month: "short" });
    const yr = weekStart.getFullYear();
    const mo = String(weekStart.getMonth() + 1).padStart(2, "0");

    weeklyEarnings.push({
      week: label,
      yearMonth: `${yr}-${mo}`,
      current: weekTotals.get(key) ?? 0,
      prior: weekTotals.get(priorKey) ?? 0,
    });
  }

  // Build day-by-day cumulative series.
  // Current month: days 1 → today (future-dated entries excluded via todayStr comparison).
  // Prior month: full month (days 1 → end of prior month) so the chart always has
  // a complete reference line regardless of how early in the current month it is.
  const mtdEntries = entries.filter((e) => {
    const d = new Date(e.date + "T00:00:00");
    return e.date <= todayStr && d.getFullYear() === currentYear && d.getMonth() === currentMonth;
  });
  const dailyTotals = new Map<number, number>();
  for (const e of mtdEntries) {
    const day = new Date(e.date + "T00:00:00").getDate();
    dailyTotals.set(day, (dailyTotals.get(day) ?? 0) + e.base_amount + e.bonus_amount);
  }
  const mtdDailyCumulative: MtdDailyPoint[] = [];
  let running = 0;
  for (let d = 1; d <= todayDay; d++) {
    running += dailyTotals.get(d) ?? 0;
    mtdDailyCumulative.push({ day: d, cumulative: running });
  }

  const daysInPriorMonth = new Date(priorMonthYear, priorMonth + 1, 0).getDate();
  const priorEntries = entries.filter((e) => {
    const d = new Date(e.date + "T00:00:00");
    return d.getFullYear() === priorMonthYear && d.getMonth() === priorMonth;
  });
  const priorDailyTotals = new Map<number, number>();
  for (const e of priorEntries) {
    const day = new Date(e.date + "T00:00:00").getDate();
    priorDailyTotals.set(day, (priorDailyTotals.get(day) ?? 0) + e.base_amount + e.bonus_amount);
  }
  const mtdPriorCumulative: MtdDailyPoint[] = [];
  let priorRunning = 0;
  for (let d = 1; d <= daysInPriorMonth; d++) {
    priorRunning += priorDailyTotals.get(d) ?? 0;
    mtdPriorCumulative.push({ day: d, cumulative: priorRunning });
  }

  // Contribution-style calendar: which clients had entries (or line-item
  // invoices, via the combined entries array) on each day of the past 12 months
  // (eleven prior months + current month); the client crops to what fits its
  // width. Includes future-dated entries within this week so bookings show.
  const fmtDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  // Start on the Monday on/before the 1st so week columns have no gaps
  const calStartDate = new Date(currentYear, currentMonth - 11, 1);
  calStartDate.setDate(calStartDate.getDate() - ((calStartDate.getDay() + 6) % 7));
  const calStart = fmtDate(calStartDate);
  // End on the Sunday of the current week so the last column is complete
  const calEndDate = new Date(now);
  calEndDate.setDate(now.getDate() + (7 - todayDow));
  const calEnd = fmtDate(calEndDate);
  const dayClients = new Map<string, Map<string, string>>();
  for (const e of entries) {
    if (!e.client || e.invoiceHasEntries || e.date < calStart || e.date > calEnd) continue;
    const clients = dayClients.get(e.date) ?? new Map<string, string>();
    clients.set(e.client.name, e.client.color);
    dayClients.set(e.date, clients);
  }
  const monthCalendar: CalendarDay[] = [];
  for (const d = new Date(calStartDate); d <= calEndDate; d.setDate(d.getDate() + 1)) {
    const date = fmtDate(d);
    monthCalendar.push({ date, clients: Array.from(dayClients.get(date) ?? [], ([name, color]) => ({ name, color })) });
  }

  return { mtdEarnings, mtdPriorMonth, mtdDailyCumulative, mtdPriorCumulative, outstanding, weeklyEarnings, emails, monthCalendar };
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
};

export async function fetchBusinessDetails(userId: string, token: string): Promise<BusinessDetails | null> {
  "use cache";
  cacheTag(CACHE_TAGS.settings);
  const supabase = createTokenClient(token);
  const { data, error } = await supabase
    .from("business_details")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`fetchBusinessDetails: ${error.message}`);
  return data as BusinessDetails | null;
}

export async function fetchInvoiceDetail(invoiceId: string, userId: string, token: string): Promise<InvoiceDetail | null> {
  "use cache";
  cacheTag(CACHE_TAGS.invoices);
  const supabase = createTokenClient(token);

  const { data, error } = await supabase
    .from("invoices")
    .select(`
      *,
      clients (id, name, color, address, suburb, email, abn, contact_name, entry_label, pays_super, super_rate, show_super_on_invoice, rate_hourly),
      entries (id, date, description, billing_type_snapshot, day_type, workflow_type, brand, label, role, skus, hours_worked, start_time, finish_time, break_minutes, base_amount, bonus_amount, super_amount, total_amount),
      invoice_line_items (id, invoice_id, description, quantity, amount, sort_order, details)
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
    label: string | null; role: string | null; skus: number | null;
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
    label: e.label,
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
  subject: string;
  body_text: string;
  filename: string;
  scheduled_for: string;
  sent_at: string | null;
  sent_pdf_path: string | null;
  error: string | null;
};

export async function fetchScheduledEmailForInvoice(invoiceId: string, userId: string, token: string): Promise<ScheduledEmail | null> {
  const supabase = createTokenClient(token);
  const { data, error } = await supabase
    .from("scheduled_emails")
    .select("id, status, to_address, subject, body_text, filename, scheduled_for, sent_at, sent_pdf_path, error")
    .eq("invoice_id", invoiceId)
    .eq("user_id", userId)
    .neq("status", "cancelled")
    .order("scheduled_for", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`fetchScheduledEmailForInvoice: ${error.message}`);
  if (!data) return null;
  return {
    id: data.id,
    status: data.status as ScheduledEmail["status"],
    to_address: data.to_address,
    subject: data.subject,
    body_text: data.body_text,
    filename: data.filename,
    scheduled_for: data.scheduled_for,
    sent_at: data.sent_at ?? null,
    sent_pdf_path: data.sent_pdf_path ?? null,
    error: data.error ?? null,
  };
}

export async function fetchInvoiceSequence(userId: string, token: string): Promise<InvoiceSequence | null> {
  "use cache";
  cacheTag(CACHE_TAGS.settings);
  const supabase = createTokenClient(token);
  const { data, error } = await supabase
    .from("invoice_sequence")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`fetchInvoiceSequence: ${error.message}`);
  return data as InvoiceSequence | null;
}

export type WeeklyInvoiceReminderCutoff = "immediately" | "friday_5pm" | "sunday_midnight";

export type UserPreferences = {
  user_id: string;
  bcc_self: boolean;
  mark_as_issued_on_send: boolean;
  weekly_invoice_reminder: boolean;
  weekly_invoice_reminder_cutoff: WeeklyInvoiceReminderCutoff;
  invoice_email_template: string | null;
  followup_email_template: string | null;
};

export async function fetchUserPreferences(userId: string, token: string): Promise<UserPreferences | null> {
  "use cache";
  cacheTag(CACHE_TAGS.settings);
  const supabase = createTokenClient(token);
  const { data, error } = await supabase
    .from("user_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`fetchUserPreferences: ${error.message}`);
  return data as UserPreferences | null;
}
