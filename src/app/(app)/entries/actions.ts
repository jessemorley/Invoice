"use server";

import { revalidatePath } from "next/cache";
import { createServerClient, PROTOTYPE_USER_ID } from "@/lib/supabase";
import { isoWeek } from "@/lib/format";
import type { BillingType, DayType } from "@/lib/types";

export type EntryFormData = {
  client_id: string;
  date: string;
  description: string;
  billing_type: BillingType;
  day_type: DayType | null;
  hours: number | null;
  base_amount: number;
  bonus_amount: number;
};

export async function updateEntry(id: string, data: EntryFormData) {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("entries")
    .update({
      client_id: data.client_id,
      date: data.date,
      description: data.description || null,
      billing_type_snapshot: data.billing_type,
      day_type: data.day_type,
      hours_worked: data.hours,
      base_amount: data.base_amount,
      bonus_amount: data.bonus_amount,
      total_amount: data.base_amount + data.bonus_amount,
    })
    .eq("id", id)
    .eq("user_id", PROTOTYPE_USER_ID);

  if (error) throw new Error(`updateEntry: ${error.message}`);
  revalidatePath("/entries");
}

export async function createEntry(data: EntryFormData) {
  const supabase = createServerClient();
  const { error } = await supabase.from("entries").insert({
    user_id: PROTOTYPE_USER_ID,
    client_id: data.client_id,
    date: data.date,
    description: data.description || null,
    billing_type_snapshot: data.billing_type,
    day_type: data.day_type,
    hours_worked: data.hours,
    base_amount: data.base_amount,
    bonus_amount: data.bonus_amount,
    total_amount: data.base_amount + data.bonus_amount,
  });

  if (error) throw new Error(`createEntry: ${error.message}`);
  revalidatePath("/entries");
}

export async function fetchClients() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("clients")
    .select("id, name, billing_type")
    .eq("user_id", PROTOTYPE_USER_ID)
    .eq("is_active", true)
    .order("name");

  if (error) throw new Error(`fetchClients: ${error.message}`);
  return (data ?? []).map((c) => ({ ...c, color: null as string | null }));
}
