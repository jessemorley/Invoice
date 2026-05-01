"use server";

import { updateTag, refresh } from "next/cache";
import { createServerClient, PROTOTYPE_USER_ID } from "@/lib/supabase";
import { fetchUninvoicedGroups, CACHE_TAGS } from "@/lib/queries";
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

export async function updateInvoice(id: string, data: InvoiceFormData) {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("invoices")
    .update({
      status: data.status,
      issued_date: data.issued_date || null,
      due_date: data.due_date || null,
      notes: data.notes || null,
      paid_date: data.status === "paid" ? new Date().toISOString().split("T")[0] : null,
    })
    .eq("id", id)
    .eq("user_id", PROTOTYPE_USER_ID);

  if (error) throw new Error(`updateInvoice: ${error.message}`);
  updateTag(CACHE_TAGS.invoices);
  updateTag(CACHE_TAGS.uninvoicedCount);
  refresh();
}
