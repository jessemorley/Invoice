"use server";

import { updateTag, refresh } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import { getAuthUserId } from "@/lib/auth";
import { CACHE_TAGS } from "@/lib/queries";
import type { InvoiceStatus } from "@/lib/types";

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
