"use server";

import { updateTag, refresh } from "next/cache";
import { createServerClient, PROTOTYPE_USER_ID } from "@/lib/supabase";
import { fetchUninvoicedGroups, fetchScheduledEmailForInvoice, fetchBusinessDetails, fetchInvoiceDetail, fetchFullClients, fetchWorkflowRates, fetchEntryById, CACHE_TAGS } from "@/lib/queries";
import type { InvoiceStatus } from "@/lib/types";

export async function revalidateInvoices() {
  updateTag(CACHE_TAGS.invoices);
  updateTag(CACHE_TAGS.uninvoicedCount);
  updateTag(CACHE_TAGS.clients);
  refresh();
}

export type InvoiceFormData = {
  status: InvoiceStatus;
  issued_date: string;
  paid_date: string;
  due_date: string;
  notes: string;
};

export async function loadUninvoicedGroups() {
  return fetchUninvoicedGroups(PROTOTYPE_USER_ID);
}

export async function generateInvoices(groupKeys: string[]): Promise<{ created: number }> {
  const supabase = createServerClient();
  const groups = await fetchUninvoicedGroups(PROTOTYPE_USER_ID);
  const selected = groups.filter((g) => groupKeys.includes(g.key));

  const { data: seqRaw, error: seqError } = await supabase
    .from("invoice_sequence")
    .select("invoice_prefix, due_date_offset")
    .eq("user_id", PROTOTYPE_USER_ID)
    .single();

  if (seqError) throw new Error(`generateInvoices: ${seqError.message}`);
  const seq = seqRaw as unknown as { invoice_prefix: string; due_date_offset: number };

  const dueOffset = seq.due_date_offset ?? 30;

  // Fetch full entry data needed for totals
  const { data: allEntries, error: entryError } = await supabase
    .from("entries")
    .select("id, client_id, date, base_amount, bonus_amount, super_amount, total_amount")
    .eq("user_id", PROTOTYPE_USER_ID)
    .is("invoice_id", null);

  if (entryError) throw new Error(`generateInvoices: ${entryError.message}`);

  const { isoWeek } = await import("@/lib/format");

  for (const group of selected) {
    const entries = (allEntries ?? []).filter(
      (e) => e.client_id === group.clientId && isoWeek(e.date) === group.isoWeek
    );
    if (entries.length === 0) continue;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: numData, error: numError } = await (supabase.rpc as any)("next_invoice_number_for_user", { p_user_id: PROTOTYPE_USER_ID });
    if (numError) throw new Error(`generateInvoices: ${numError.message}`);

    const subtotal = entries.reduce((s, e) => s + (e.base_amount ?? 0) + (e.bonus_amount ?? 0), 0);
    const superAmount = entries.reduce((s, e) => s + (e.super_amount ?? 0), 0);
    const total = entries.reduce((s, e) => s + (e.total_amount ?? 0), 0);

    const { data: inv, error: invError } = await supabase
      .from("invoices")
      .insert({
        user_id: PROTOTYPE_USER_ID,
        invoice_number: `${seq.invoice_prefix}${numData}`,
        client_id: group.clientId,
        subtotal,
        super_amount: superAmount,
        total,
        status: "draft",
      })
      .select("id")
      .single();

    if (invError) throw new Error(`generateInvoices: ${invError.message}`);

    const { error: linkError } = await supabase
      .from("entries")
      .update({ invoice_id: inv.id })
      .in("id", entries.map((e) => e.id));

    if (linkError) throw new Error(`generateInvoices: ${linkError.message}`);
  }

  updateTag(CACHE_TAGS.invoices);
  updateTag(CACHE_TAGS.uninvoicedCount);
  updateTag(CACHE_TAGS.entries);
  refresh();

  return { created: selected.length };
}

export async function deleteInvoice(id: string) {
  const supabase = createServerClient();

  const { error: unlinkError } = await supabase
    .from("entries")
    .update({ invoice_id: null })
    .eq("invoice_id", id)
    .eq("user_id", PROTOTYPE_USER_ID);

  if (unlinkError) throw new Error(`deleteInvoice (unlink): ${unlinkError.message}`);

  const { error } = await supabase
    .from("invoices")
    .delete()
    .eq("id", id)
    .eq("user_id", PROTOTYPE_USER_ID);

  if (error) throw new Error(`deleteInvoice: ${error.message}`);

  updateTag(CACHE_TAGS.invoices);
  updateTag(CACHE_TAGS.uninvoicedCount);
  updateTag(CACHE_TAGS.entries);
  refresh();
}

export type EmailFormData = {
  to: string;
  subject: string;
  body_text: string;
  scheduled_for: string;
};

export async function loadEntrySheetData(entryId: string) {
  const [entry, clients, workflowRates] = await Promise.all([
    fetchEntryById(PROTOTYPE_USER_ID, entryId),
    fetchFullClients(PROTOTYPE_USER_ID),
    fetchWorkflowRates(),
  ]);
  return { entry, clients, workflowRates };
}

export async function loadScheduledEmail(invoiceId: string) {
  const [scheduledEmail, invoiceDetail, businessDetails] = await Promise.all([
    fetchScheduledEmailForInvoice(invoiceId, PROTOTYPE_USER_ID),
    fetchInvoiceDetail(invoiceId, PROTOTYPE_USER_ID),
    fetchBusinessDetails(PROTOTYPE_USER_ID),
  ]);
  return {
    scheduledEmail,
    invoiceDetail,
    businessName: businessDetails?.business_name ?? businessDetails?.name ?? "",
  };
}

export async function scheduleInvoiceEmail(invoiceId: string, data: EmailFormData): Promise<{ id: string }> {
  const supabase = createServerClient();

  const { data: inv, error: invError } = await supabase
    .from("invoices")
    .select("invoice_number")
    .eq("id", invoiceId)
    .eq("user_id", PROTOTYPE_USER_ID)
    .single();

  if (invError) throw new Error(`scheduleInvoiceEmail (fetch): ${invError.message}`);

  const { data: row, error } = await supabase.from("scheduled_emails").insert({
    user_id: PROTOTYPE_USER_ID,
    invoice_id: invoiceId,
    to_address: data.to,
    subject: data.subject,
    body_text: data.body_text,
    scheduled_for: data.scheduled_for,
    filename: `${inv.invoice_number}.pdf`,
    mark_issued: true,
    status: "pending",
  }).select("id").single();

  if (error) throw new Error(`scheduleInvoiceEmail: ${error.message}`);
  updateTag(CACHE_TAGS.scheduledEmails);
  refresh();
  return { id: row.id };
}

export async function cancelScheduledEmail(scheduledEmailId: string): Promise<void> {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("scheduled_emails")
    .update({ status: "cancelled" })
    .eq("id", scheduledEmailId)
    .eq("user_id", PROTOTYPE_USER_ID);

  if (error) throw new Error(`cancelScheduledEmail: ${error.message}`);
  updateTag(CACHE_TAGS.scheduledEmails);
  refresh();
}

export async function sendScheduledEmailNow(scheduledEmailId: string): Promise<void> {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("scheduled_emails")
    .update({ scheduled_for: new Date().toISOString() })
    .eq("id", scheduledEmailId)
    .eq("status", "pending")
    .eq("user_id", PROTOTYPE_USER_ID);

  if (error) throw new Error(`sendScheduledEmailNow: ${error.message}`);
  updateTag(CACHE_TAGS.scheduledEmails);
  refresh();
}

export async function createLineItem(invoiceId: string, data: { description: string; quantity: number | null; amount: number; sort_order: number }) {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("invoice_line_items")
    .insert({
      invoice_id: invoiceId,
      user_id: PROTOTYPE_USER_ID,
      description: data.description,
      quantity: data.quantity,
      amount: data.amount,
      sort_order: data.sort_order,
    });
  if (error) throw new Error(`createLineItem: ${error.message}`);
  updateTag(CACHE_TAGS.invoices);
  refresh();
}

export async function updateInvoice(id: string, data: InvoiceFormData) {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("invoices")
    .update({
      status: data.status,
      issued_date: data.issued_date || null,
      due_date: data.due_date || null,
      notes: data.notes || null,
      paid_date: data.paid_date || null,
    })
    .eq("id", id)
    .eq("user_id", PROTOTYPE_USER_ID);

  if (error) throw new Error(`updateInvoice: ${error.message}`);
  updateTag(CACHE_TAGS.invoices);
  updateTag(CACHE_TAGS.uninvoicedCount);
  refresh();
}
