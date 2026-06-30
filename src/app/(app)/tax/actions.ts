"use server";

import { updateTag, refresh } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import { getAuthUserId } from "@/lib/auth";
import { CACHE_TAGS } from "@/lib/queries";

export type PaygInstalmentFormData = {
  paid_date: string;
  amount: number;
  label: string | null;
};

export async function createPaygInstalment(data: PaygInstalmentFormData): Promise<string> {
  const [supabase, userId] = await Promise.all([createClient(), getAuthUserId()]);
  const { data: row, error } = await supabase
    .from("payg_instalments")
    .insert({
      user_id: userId,
      paid_date: data.paid_date,
      amount: data.amount,
      label: data.label ?? null,
    })
    .select("id")
    .single();

  if (error) throw new Error(`createPaygInstalment: ${error.message}`);
  updateTag(CACHE_TAGS.payg);
  refresh();
  return row.id;
}

export async function deletePaygInstalment(id: string) {
  const [supabase, userId] = await Promise.all([createClient(), getAuthUserId()]);
  const { error } = await supabase
    .from("payg_instalments")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw new Error(`deletePaygInstalment: ${error.message}`);
  updateTag(CACHE_TAGS.payg);
  refresh();
}
