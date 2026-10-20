import { cacheTag } from "next/cache";
import { createTokenClient } from "./supabase";
import { isoWeek } from "./format";
import {
  CLIENT_COLOR_FALLBACK,
  toClientRef,
  readEntries,
  readUninvoicedGroups,
  readFullClients,
  readWorkflowRates,
  readBusinessDetails,
  readInvoiceSequence,
  readUserPreferences,
  type BusinessDetails,
  type InvoiceSequence,
  type UninvoicedGroup,
  type UserPreferences,
} from "./reads";
import type { Entry, InvoiceDetail, InvoiceEntry, InvoiceStatus, InvoiceRef, Client, WorkflowRate } from "./types";

// Server-side reads for actions, API routes and SSR. View data is read in the
// browser (src/lib/view-loaders.ts); the query bodies live in src/lib/reads.ts.
export type {
  BusinessDetails,
  InvoiceSequence,
  UninvoicedGroup,
  SuggestedInvoice,
  UserPreferences,
  WeeklyInvoiceReminderCutoff,
  InvoiceFilters,
  TaxClientIncome,
  PaygInstalment,
  TaxMonthTotals,
  TaxFyTotals,
} from "./reads";

export const CACHE_TAGS = {
  entries: "entries",
  invoices: "invoices",
  expenses: "expenses",
  clients: "clients",
  settings: "settings",
  scheduledEmails: "scheduled-emails",
  payg: "payg",
} as const;

export async function fetchEntries(userId: string, token: string, before?: string): Promise<Entry[]> {
  "use cache";
  cacheTag(CACHE_TAGS.entries);
  return readEntries(createTokenClient(token), userId, before);
}

export async function fetchUninvoicedGroups(userId: string, token: string): Promise<UninvoicedGroup[]> {
  "use cache";
  cacheTag(CACHE_TAGS.entries);
  return readUninvoicedGroups(createTokenClient(token), userId);
}

export async function fetchFullClients(userId: string, token: string): Promise<Client[]> {
  "use cache";
  cacheTag(CACHE_TAGS.clients);
  return readFullClients(createTokenClient(token), userId);
}

export async function fetchWorkflowRates(token: string): Promise<WorkflowRate[]> {
  "use cache";
  cacheTag(CACHE_TAGS.clients);
  return readWorkflowRates(createTokenClient(token));
}

export async function fetchBusinessDetails(userId: string, token: string): Promise<BusinessDetails | null> {
  "use cache";
  cacheTag(CACHE_TAGS.settings);
  return readBusinessDetails(createTokenClient(token), userId);
}

export async function fetchInvoiceSequence(userId: string, token: string): Promise<InvoiceSequence | null> {
  "use cache";
  cacheTag(CACHE_TAGS.settings);
  return readInvoiceSequence(createTokenClient(token), userId);
}

export async function fetchUserPreferences(userId: string, token: string): Promise<UserPreferences | null> {
  "use cache";
  cacheTag(CACHE_TAGS.settings);
  return readUserPreferences(createTokenClient(token), userId);
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
    batch_lines: data.batch_lines as Entry["batch_lines"],
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
    .select("id, date, description, billing_type_snapshot, day_type, workflow_type, batch_lines, brand, label, role, skus, hours_worked, start_time, finish_time, break_minutes, base_amount, bonus_amount, super_amount, total_amount")
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
      batch_lines: e.batch_lines as InvoiceEntry["batch_lines"],
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

export async function fetchInvoiceDetail(invoiceId: string, userId: string, token: string): Promise<InvoiceDetail | null> {
  "use cache";
  cacheTag(CACHE_TAGS.invoices);
  const supabase = createTokenClient(token);

  const { data, error } = await supabase
    .from("invoices")
    .select(`
      *,
      clients (id, name, color, address, suburb, email, abn, contact_name, entry_label, pays_super, super_rate, show_super_on_invoice, rate_hourly),
      entries (id, date, description, billing_type_snapshot, day_type, workflow_type, batch_lines, brand, label, role, skus, hours_worked, start_time, finish_time, break_minutes, base_amount, bonus_amount, super_amount, total_amount),
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
    workflow_type: string | null; batch_lines: unknown; brand: string | null;
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
    batch_lines: e.batch_lines as InvoiceDetail["entries"][0]["batch_lines"],
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
  status: "pending" | "sent" | "cancelled" | "failed" | "bounced";
  to_address: string;
  cc_address: string | null;
  bcc_address: string | null;
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
    .select("id, status, to_address, cc_address, bcc_address, subject, body_text, filename, scheduled_for, sent_at, sent_pdf_path, error")
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
    cc_address: data.cc_address ?? null,
    bcc_address: data.bcc_address ?? null,
    subject: data.subject,
    body_text: data.body_text,
    // Invoice-scoped emails always carry a filename; null only occurs on free-form rows.
    filename: data.filename ?? "",
    scheduled_for: data.scheduled_for,
    sent_at: data.sent_at ?? null,
    sent_pdf_path: data.sent_pdf_path ?? null,
    error: data.error ?? null,
  };
}
