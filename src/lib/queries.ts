import { createServerClient } from "./supabase";
import { isoWeek } from "./format";
import type { Entry, Invoice, Expense, DashboardData, ClientRef, MonthlyEarning } from "./types";

const CLIENT_COLOR_FALLBACK = "#9ca3af";

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

export async function fetchEntries(userId: string): Promise<Entry[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("entries")
    .select("*, clients(id, name, billing_type)")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .limit(200);

  if (error) throw new Error(`fetchEntries: ${error.message}`);

  return (data ?? []).map((e) => {
    const client = Array.isArray(e.clients) ? e.clients[0] : e.clients;
    return {
      id: e.id,
      client: toClientRef(client ?? { id: e.client_id, name: "Unknown", billing_type: "day_rate" }),
      date: e.date,
      description: e.description,
      billing_type: e.billing_type_snapshot,
      day_type: e.day_type,
      hours: e.hours_worked,
      base_amount: e.base_amount,
      bonus_amount: e.bonus_amount,
      super_amount: e.super_amount,
      total: e.total_amount,
      invoice_id: e.invoice_id,
      iso_week: isoWeek(e.date),
    };
  });
}

export async function fetchInvoices(userId: string, entries: Entry[]): Promise<Invoice[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("invoices")
    .select("*, clients(id, name, billing_type)")
    .eq("user_id", userId)
    .order("issued_date", { ascending: false });

  if (error) throw new Error(`fetchInvoices: ${error.message}`);

  return (data ?? []).map((inv) => {
    const client = Array.isArray(inv.clients) ? inv.clients[0] : inv.clients;
    const invoiceEntries = entries.filter((e) => e.invoice_id === inv.id);
    return {
      id: inv.id,
      number: inv.invoice_number,
      client: toClientRef(client ?? { id: inv.client_id, name: "Unknown", billing_type: "day_rate" }),
      issued_date: inv.issued_date,
      date_range: computeDateRange(invoiceEntries.map((e) => e.date)),
      subtotal: inv.subtotal,
      super_amount: inv.super_amount,
      total: inv.total,
      status: inv.status,
      entry_count: invoiceEntries.length,
    };
  });
}

export async function fetchExpenses(userId: string): Promise<Expense[]> {
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
