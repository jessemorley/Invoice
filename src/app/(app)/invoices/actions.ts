"use server";

import { updateTag, refresh } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import { getAuthUserId, getAuthToken, getAuthUser } from "@/lib/auth";
import { fetchUninvoicedGroups, fetchScheduledEmailForInvoice, fetchBusinessDetails, fetchInvoiceDetail, fetchFullClients, fetchWorkflowRates, fetchEntryById, fetchUserPreferences, CACHE_TAGS } from "@/lib/queries";
import { inngest } from "@/lib/inngest";
import type { InvoiceStatus } from "@/lib/types";

export async function revalidateInvoices() {
  updateTag(CACHE_TAGS.invoices);
  updateTag(CACHE_TAGS.entries);
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
  const [userId, token] = await Promise.all([getAuthUserId(), getAuthToken()]);
  return fetchUninvoicedGroups(userId, token);
}

export async function generateInvoices(groupKeys: string[]): Promise<{ created: number }> {
  const [supabase, userId, token] = await Promise.all([createClient(), getAuthUserId(), getAuthToken()]);
  const groups = await fetchUninvoicedGroups(userId, token);
  const selected = groups.filter((g) => groupKeys.includes(g.key));

  const { data: seqRaw, error: seqError } = await supabase
    .from("invoice_sequence")
    .select("invoice_prefix, due_date_offset")
    .eq("user_id", userId)
    .single();

  if (seqError) throw new Error(`generateInvoices: ${seqError.message}`);
  const seq = seqRaw as unknown as { invoice_prefix: string; due_date_offset: number };

  const dueOffset = seq.due_date_offset ?? 30;

  const { data: allEntries, error: entryError } = await supabase
    .from("entries")
    .select("id, client_id, date, base_amount, bonus_amount, super_amount, total_amount")
    .eq("user_id", userId)
    .is("invoice_id", null);

  if (entryError) throw new Error(`generateInvoices: ${entryError.message}`);

  const { isoWeek } = await import("@/lib/format");

  for (const group of selected) {
    const entries = (allEntries ?? []).filter(
      (e) => e.client_id === group.clientId && isoWeek(e.date) === group.isoWeek
    );
    if (entries.length === 0) continue;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: numData, error: numError } = await (supabase.rpc as any)("next_invoice_number_for_user", { p_user_id: userId });
    if (numError) throw new Error(`generateInvoices: ${numError.message}`);

    const subtotal = entries.reduce((s, e) => s + (e.base_amount ?? 0) + (e.bonus_amount ?? 0), 0);
    const superAmount = entries.reduce((s, e) => s + (e.super_amount ?? 0), 0);
    const total = entries.reduce((s, e) => s + (e.total_amount ?? 0), 0);

    const { data: inv, error: invError } = await supabase
      .from("invoices")
      .insert({
        user_id: userId,
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
  updateTag(CACHE_TAGS.entries);
  refresh();

  return { created: selected.length };
}

export async function deleteInvoice(id: string) {
  const [supabase, userId] = await Promise.all([createClient(), getAuthUserId()]);

  const { error: unlinkError } = await supabase
    .from("entries")
    .update({ invoice_id: null })
    .eq("invoice_id", id)
    .eq("user_id", userId);

  if (unlinkError) throw new Error(`deleteInvoice (unlink): ${unlinkError.message}`);

  const { error } = await supabase
    .from("invoices")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw new Error(`deleteInvoice: ${error.message}`);

  updateTag(CACHE_TAGS.invoices);
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
  const [userId, token] = await Promise.all([getAuthUserId(), getAuthToken()]);
  const [entry, clients, workflowRates] = await Promise.all([
    fetchEntryById(userId, entryId, token),
    fetchFullClients(userId, token),
    fetchWorkflowRates(token),
  ]);
  return { entry, clients, workflowRates };
}

export async function loadScheduledEmail(invoiceId: string) {
  const [userId, token] = await Promise.all([getAuthUserId(), getAuthToken()]);
  const [scheduledEmail, invoiceDetail, businessDetails] = await Promise.all([
    fetchScheduledEmailForInvoice(invoiceId, userId, token),
    fetchInvoiceDetail(invoiceId, userId, token),
    fetchBusinessDetails(userId, token),
  ]);
  return {
    scheduledEmail,
    invoiceDetail,
    businessName: businessDetails?.business_name ?? businessDetails?.name ?? "",
  };
}

export async function scheduleInvoiceEmail(invoiceId: string, data: EmailFormData): Promise<{ id: string }> {
  const [supabase, userId, token] = await Promise.all([createClient(), getAuthUserId(), getAuthToken()]);

  const [invResult, business, userPrefs] = await Promise.all([
    supabase.from("invoices").select("invoice_number").eq("id", invoiceId).eq("user_id", userId).single(),
    fetchBusinessDetails(userId, token),
    fetchUserPreferences(userId, token),
  ]);

  if (invResult.error) throw new Error(`scheduleInvoiceEmail (fetch): ${invResult.error.message}`);
  const inv = invResult.data;

  const businessName = business?.business_name ?? "";
  const filename = businessName
    ? `${businessName} Invoice ${inv.invoice_number}.pdf`
    : `Invoice ${inv.invoice_number}.pdf`;
  const bccAddress = userPrefs?.bcc_self ? (await getAuthUser()).email : null;
  const markIssued = userPrefs?.mark_as_issued_on_send ?? false;

  const { data: row, error } = await supabase.from("scheduled_emails").insert({
    user_id: userId,
    invoice_id: invoiceId,
    to_address: data.to,
    subject: data.subject,
    body_text: data.body_text,
    scheduled_for: data.scheduled_for,
    filename,
    bcc_address: bccAddress,
    mark_issued: markIssued,
    status: "pending",
  }).select("id").single();

  if (error) throw new Error(`scheduleInvoiceEmail: ${error.message}`);

  await inngest.send({
    name: "invoice/email.scheduled",
    data: {
      scheduled_email_id: row.id,
      user_id: userId,
      invoice_id: invoiceId,
      to_address: data.to,
      cc_address: null,
      bcc_address: bccAddress,
      subject: data.subject,
      body_text: data.body_text,
      filename,
      mark_issued: markIssued,
      scheduled_for: data.scheduled_for,
    },
    ts: new Date(data.scheduled_for).getTime(),
  });

  updateTag(CACHE_TAGS.scheduledEmails);
  refresh();
  return { id: row.id };
}

export async function cancelScheduledEmail(scheduledEmailId: string): Promise<void> {
  const [supabase, userId] = await Promise.all([createClient(), getAuthUserId()]);
  const { error } = await supabase
    .from("scheduled_emails")
    .update({ status: "cancelled" })
    .eq("id", scheduledEmailId)
    .eq("user_id", userId);

  if (error) throw new Error(`cancelScheduledEmail: ${error.message}`);

  await inngest.send({
    name: "invoice/email.cancelled",
    data: { scheduled_email_id: scheduledEmailId },
  });

  updateTag(CACHE_TAGS.scheduledEmails);
  refresh();
}

export async function sendScheduledEmailNow(scheduledEmailId: string): Promise<void> {
  const [supabase, userId] = await Promise.all([createClient(), getAuthUserId()]);

  // Cancel the originally-scheduled Inngest job and re-enqueue immediately
  await inngest.send([
    {
      name: "invoice/email.cancelled",
      data: { scheduled_email_id: scheduledEmailId },
    },
  ]);

  const { data: row, error } = await supabase
    .from("scheduled_emails")
    .update({ scheduled_for: new Date().toISOString() })
    .eq("id", scheduledEmailId)
    .eq("status", "pending")
    .eq("user_id", userId)
    .select("user_id, invoice_id, to_address, cc_address, bcc_address, subject, body_text, filename, mark_issued, scheduled_for")
    .single();

  if (error) throw new Error(`sendScheduledEmailNow: ${error.message}`);

  await inngest.send({
    name: "invoice/email.scheduled",
    data: {
      scheduled_email_id: scheduledEmailId,
      user_id: row.user_id,
      invoice_id: row.invoice_id,
      to_address: row.to_address,
      cc_address: row.cc_address,
      bcc_address: row.bcc_address,
      subject: row.subject,
      body_text: row.body_text,
      filename: row.filename,
      mark_issued: row.mark_issued,
      scheduled_for: row.scheduled_for,
    },
    // ts omitted = send immediately
  });

  updateTag(CACHE_TAGS.scheduledEmails);
  refresh();
}

async function recomputeInvoiceTotal(supabase: Awaited<ReturnType<typeof createClient>>, invoiceId: string) {
  const { data: inv } = await supabase
    .from("invoices")
    .select("client_id, clients(pays_super, super_rate)")
    .eq("id", invoiceId)
    .single();

  const { data: entries } = await supabase
    .from("entries")
    .select("base_amount, bonus_amount")
    .eq("invoice_id", invoiceId);

  const { data: lineItems } = await supabase
    .from("invoice_line_items")
    .select("amount")
    .eq("invoice_id", invoiceId);

  const entriesTotal = (entries ?? []).reduce((s, e) => s + Number(e.base_amount) + Number(e.bonus_amount), 0);
  const lineItemsTotal = (lineItems ?? []).reduce((s, i) => s + Number(i.amount), 0);
  const subtotal = entriesTotal + lineItemsTotal;

  const client = Array.isArray(inv?.clients) ? inv!.clients[0] : inv?.clients;
  const paysSuper: boolean = (client as { pays_super: boolean } | null)?.pays_super ?? false;
  const superRate: number = Number((client as { super_rate: number } | null)?.super_rate ?? 0.12);
  const superAmount = paysSuper ? subtotal * superRate : 0;

  const { error: updateError } = await supabase
    .from("invoices")
    .update({ subtotal, super_amount: superAmount, total: subtotal + superAmount })
    .eq("id", invoiceId);
  if (updateError) throw new Error(`recomputeInvoiceTotal: ${updateError.message}`);
}

export async function createLineItem(invoiceId: string, data: { description: string; quantity: number | null; amount: number; sort_order: number }) {
  const [supabase, userId] = await Promise.all([createClient(), getAuthUserId()]);
  const { error } = await supabase
    .from("invoice_line_items")
    .insert({
      invoice_id: invoiceId,
      user_id: userId,
      description: data.description,
      quantity: data.quantity,
      amount: data.amount,
      sort_order: data.sort_order,
    });
  if (error) throw new Error(`createLineItem: ${error.message}`);
  await recomputeInvoiceTotal(supabase, invoiceId);
  updateTag(CACHE_TAGS.invoices);
  refresh();
}

export async function updateLineItem(id: string, data: { description: string; quantity: number | null; amount: number }) {
  const [supabase, userId] = await Promise.all([createClient(), getAuthUserId()]);
  const { data: item, error } = await supabase
    .from("invoice_line_items")
    .update({ description: data.description, quantity: data.quantity, amount: data.amount })
    .eq("id", id)
    .eq("user_id", userId)
    .select("invoice_id")
    .single();
  if (error) throw new Error(`updateLineItem: ${error.message}`);
  await recomputeInvoiceTotal(supabase, item.invoice_id);
  updateTag(CACHE_TAGS.invoices);
  refresh();
}

export async function deleteLineItem(id: string) {
  const [supabase, userId] = await Promise.all([createClient(), getAuthUserId()]);
  const { data: item, error: fetchError } = await supabase
    .from("invoice_line_items")
    .select("invoice_id")
    .eq("id", id)
    .eq("user_id", userId)
    .single();
  if (fetchError) throw new Error(`deleteLineItem: ${fetchError.message}`);
  const { error } = await supabase
    .from("invoice_line_items")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw new Error(`deleteLineItem: ${error.message}`);
  await recomputeInvoiceTotal(supabase, item.invoice_id);
  updateTag(CACHE_TAGS.invoices);
  refresh();
}

export async function updateInvoice(id: string, data: InvoiceFormData) {
  const [supabase, userId] = await Promise.all([createClient(), getAuthUserId()]);
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
    .eq("user_id", userId);

  if (error) throw new Error(`updateInvoice: ${error.message}`);
  updateTag(CACHE_TAGS.invoices);
  updateTag(CACHE_TAGS.entries);
  refresh();
}
