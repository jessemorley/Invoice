"use server";

import { revalidateTag, updateTag } from "next/cache";
import { createServerClient, PROTOTYPE_USER_ID } from "@/lib/supabase";
import { fetchInvoices, CACHE_TAGS, type InvoiceFilters } from "@/lib/queries";
import type { Invoice, InvoiceStatus } from "@/lib/types";

export async function loadMoreInvoices(before: string, filters: InvoiceFilters): Promise<Invoice[]> {
  const d = new Date(before + "T00:00:00");
  d.setMonth(d.getMonth() - 3);
  const windowEnd = before;
  const windowStart = d.toISOString().slice(0, 10);
  return fetchInvoices(PROTOTYPE_USER_ID, {
    ...filters,
    from: windowStart,
    to: windowEnd,
  });
}

export type InvoiceFormData = {
  status: InvoiceStatus;
  issued_date: string;
  due_date: string;
  notes: string;
};

export async function updateInvoice(id: string, data: InvoiceFormData) {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("invoices")
    .update({
      status: data.status,
      issued_date: data.issued_date,
      due_date: data.due_date,
      notes: data.notes || null,
      paid_date: data.status === "paid" ? new Date().toISOString().split("T")[0] : null,
    })
    .eq("id", id)
    .eq("user_id", PROTOTYPE_USER_ID);

  if (error) throw new Error(`updateInvoice: ${error.message}`);
  revalidateTag(CACHE_TAGS.invoices, {});
  revalidateTag(CACHE_TAGS.uninvoicedCount, {});
  updateTag(CACHE_TAGS.invoices);
  updateTag(CACHE_TAGS.uninvoicedCount);
}
