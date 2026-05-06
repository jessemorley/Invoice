"use server";

import { updateTag, refresh } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import { getAuthUserId } from "@/lib/auth";
import { CACHE_TAGS } from "@/lib/queries";
import type { BillingType, InvoiceStatus } from "@/lib/types";

export type ClientFormData = {
  name: string;
  billing_type: BillingType;
  rate_full_day: number | null;
  rate_half_day: number | null;
  rate_hourly: number | null;
  rate_hourly_photographer: number | null;
  rate_hourly_operator: number | null;
  default_start_time: string | null;
  default_finish_time: string | null;
  entry_label: string | null;
  show_role: boolean;
  pays_super: boolean;
  super_rate: number;
  show_super_on_invoice: boolean;
  invoice_frequency: "weekly" | "per_job";
  contact_name: string | null;
  email: string;
  address: string;
  suburb: string;
  abn: string | null;
  is_active: boolean;
};

export async function createClientAction(data: ClientFormData): Promise<{ id: string }> {
  const [supabase, userId] = await Promise.all([createClient(), getAuthUserId()]);
  const { data: row, error } = await supabase
    .from("clients")
    .insert({ ...data, user_id: userId })
    .select("id")
    .single();

  if (error) throw new Error(`createClientAction: ${error.message}`);
  updateTag(CACHE_TAGS.clients);
  updateTag(CACHE_TAGS.entries);
  refresh();
  return { id: row.id };
}

export async function updateClientAction(clientId: string, data: ClientFormData): Promise<void> {
  const [supabase, userId] = await Promise.all([createClient(), getAuthUserId()]);
  const { error } = await supabase
    .from("clients")
    .update(data)
    .eq("id", clientId)
    .eq("user_id", userId);

  if (error) throw new Error(`updateClientAction: ${error.message}`);
  updateTag(CACHE_TAGS.clients);
  updateTag(CACHE_TAGS.entries);
  updateTag(CACHE_TAGS.invoices);
  refresh();
}

export type DeleteClientResult =
  | { ok: true }
  | { ok: false; reason: "has_data"; invoiceCount: number; entryCount: number };

export async function deleteClientAction(clientId: string): Promise<DeleteClientResult> {
  const [supabase, userId] = await Promise.all([createClient(), getAuthUserId()]);

  const { data: owned } = await supabase
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .eq("user_id", userId)
    .single();

  if (!owned) throw new Error("deleteClientAction: client not found");

  const [{ count: invoiceCount }, { count: entryCount }] = await Promise.all([
    supabase.from("invoices").select("id", { count: "exact", head: true }).eq("client_id", clientId).eq("user_id", userId),
    supabase.from("entries").select("id", { count: "exact", head: true }).eq("client_id", clientId).eq("user_id", userId),
  ]);

  if ((invoiceCount ?? 0) > 0 || (entryCount ?? 0) > 0) {
    return { ok: false, reason: "has_data", invoiceCount: invoiceCount ?? 0, entryCount: entryCount ?? 0 };
  }

  await supabase.from("client_workflow_rates").delete().eq("client_id", clientId);
  const { error } = await supabase.from("clients").delete().eq("id", clientId).eq("user_id", userId);
  if (error) throw new Error(`deleteClientAction: ${error.message}`);

  updateTag(CACHE_TAGS.clients);
  refresh();
  return { ok: true };
}

export type RecentInvoice = {
  id: string;
  number: string;
  issued_date: string | null;
  total: number;
  status: InvoiceStatus;
};

export async function fetchClientInvoices(clientId: string): Promise<RecentInvoice[]> {
  const [supabase, userId] = await Promise.all([createClient(), getAuthUserId()]);
  const { data, error } = await supabase
    .from("invoices")
    .select("id, invoice_number, issued_date, total, status")
    .eq("user_id", userId)
    .eq("client_id", clientId)
    .order("issued_date", { ascending: false })
    .limit(5);

  if (error) throw new Error(`fetchClientInvoices: ${error.message}`);
  return (data ?? []).map((inv) => ({ ...inv, number: inv.invoice_number }));
}

export async function updateClientColor(clientId: string, color: string) {
  const [supabase, userId] = await Promise.all([createClient(), getAuthUserId()]);
  const { error } = await supabase
    .from("clients")
    .update({ color })
    .eq("id", clientId)
    .eq("user_id", userId);

  if (error) throw new Error(`updateClientColor: ${error.message}`);
  updateTag(CACHE_TAGS.clients);
  updateTag(CACHE_TAGS.entries);
  refresh();
}

export async function updateShowSuperOnInvoice(clientId: string, show: boolean) {
  const [supabase, userId] = await Promise.all([createClient(), getAuthUserId()]);
  const { error } = await supabase
    .from("clients")
    .update({ show_super_on_invoice: show })
    .eq("id", clientId)
    .eq("user_id", userId);

  if (error) throw new Error(`updateShowSuperOnInvoice: ${error.message}`);
  updateTag(CACHE_TAGS.clients);
  refresh();
}
