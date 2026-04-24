"use server";

import { updateTag, refresh } from "next/cache";
import { createServerClient, PROTOTYPE_USER_ID } from "@/lib/supabase";
import { CACHE_TAGS } from "@/lib/queries";
import type { InvoiceStatus } from "@/lib/types";

export type RecentInvoice = {
  id: string;
  number: string;
  issued_date: string;
  total: number;
  status: InvoiceStatus;
};

export async function fetchClientInvoices(clientId: string): Promise<RecentInvoice[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("invoices")
    .select("id, invoice_number, issued_date, total, status")
    .eq("user_id", PROTOTYPE_USER_ID)
    .eq("client_id", clientId)
    .order("issued_date", { ascending: false })
    .limit(5);

  if (error) throw new Error(`fetchClientInvoices: ${error.message}`);
  return (data ?? []).map((inv) => ({ ...inv, number: inv.invoice_number }));
}

export async function updateClientColor(clientId: string, color: string) {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("clients")
    .update({ color })
    .eq("id", clientId)
    .eq("user_id", PROTOTYPE_USER_ID);

  if (error) throw new Error(`updateClientColor: ${error.message}`);
  updateTag(CACHE_TAGS.clients);
  updateTag(CACHE_TAGS.entries);
  refresh();
}

export async function updateShowSuperOnInvoice(clientId: string, show: boolean) {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("clients")
    .update({ show_super_on_invoice: show })
    .eq("id", clientId)
    .eq("user_id", PROTOTYPE_USER_ID);

  if (error) throw new Error(`updateShowSuperOnInvoice: ${error.message}`);
  updateTag(CACHE_TAGS.clients);
  refresh();
}
