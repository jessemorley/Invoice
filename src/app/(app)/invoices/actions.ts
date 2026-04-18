"use server";

import { revalidatePath } from "next/cache";
import { createServerClient, PROTOTYPE_USER_ID } from "@/lib/supabase";
import type { InvoiceStatus } from "@/lib/types";

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
  revalidatePath("/invoices");
}
