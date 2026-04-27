"use server";

import { updateTag, refresh } from "next/cache";
import { createServerClient, PROTOTYPE_USER_ID } from "@/lib/supabase";
import { CACHE_TAGS } from "@/lib/queries";
import type { ExpenseCategory } from "@/lib/types";

export async function getReceiptUrl(path: string): Promise<string> {
  const supabase = createServerClient();
  const { data, error } = await supabase.storage
    .from("receipts")
    .createSignedUrl(path, 3600);
  if (error) throw new Error(`getReceiptUrl: ${error.message}`);
  return data.signedUrl;
}

export async function deleteReceipt(expenseId: string, path: string) {
  const supabase = createServerClient();
  const { error: storageError } = await supabase.storage
    .from("receipts")
    .remove([path]);
  if (storageError) throw new Error(`deleteReceipt: ${storageError.message}`);

  const { error: dbError } = await supabase
    .from("expenses")
    .update({ receipt_path: null })
    .eq("id", expenseId)
    .eq("user_id", PROTOTYPE_USER_ID);
  if (dbError) throw new Error(`deleteReceipt: ${dbError.message}`);

  updateTag(CACHE_TAGS.expenses);
  refresh();
}

export type ExpenseFormData = {
  date: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  gst_included: boolean;
  notes: string | null;
  is_billable: boolean;
};

export async function createExpense(data: ExpenseFormData): Promise<string> {
  const supabase = createServerClient();
  const { data: row, error } = await supabase
    .from("expenses")
    .insert({
      user_id: PROTOTYPE_USER_ID,
      date: data.date,
      category: data.category,
      description: data.description,
      amount: data.amount,
      gst_included: data.gst_included,
      notes: data.notes ?? null,
      is_billable: data.is_billable,
    })
    .select("id")
    .single();

  if (error) throw new Error(`createExpense: ${error.message}`);
  updateTag(CACHE_TAGS.expenses);
  refresh();
  return row.id;
}

export async function updateExpense(id: string, data: ExpenseFormData) {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("expenses")
    .update({
      date: data.date,
      category: data.category,
      description: data.description,
      amount: data.amount,
      gst_included: data.gst_included,
      notes: data.notes ?? null,
      is_billable: data.is_billable,
    })
    .eq("id", id)
    .eq("user_id", PROTOTYPE_USER_ID);

  if (error) throw new Error(`updateExpense: ${error.message}`);
  updateTag(CACHE_TAGS.expenses);
  refresh();
}

export async function deleteExpense(id: string) {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", id)
    .eq("user_id", PROTOTYPE_USER_ID);

  if (error) throw new Error(`deleteExpense: ${error.message}`);
  updateTag(CACHE_TAGS.expenses);
  refresh();
}
