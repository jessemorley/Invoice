"use server";

import { updateTag, refresh } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import { getAuthUserId, getAuthToken } from "@/lib/auth";
import type { BillingType, DayType } from "@/lib/types";
import { fetchEntries, fetchFullClients, fetchWorkflowRates, CACHE_TAGS } from "@/lib/queries";
import type { Entry } from "@/lib/types";

export async function loadEarlierEntries(before: string): Promise<Entry[]> {
  const [userId, token] = await Promise.all([getAuthUserId(), getAuthToken()]);
  const d = new Date(before + "T00:00:00");
  d.setDate(d.getDate() - 1);
  const newBefore = d.toISOString().slice(0, 10);
  return fetchEntries(userId, token, newBefore);
}

export type EntryFormData = {
  client_id: string;
  date: string;
  billing_type: BillingType;
  day_type: DayType | null;
  workflow_type: string | null;
  skus: number | null;
  brand: string | null;
  shoot_client: string | null;
  description: string | null;
  role: string | null;
  start_time: string | null;
  finish_time: string | null;
  break_minutes: number | null;
  hours_worked: number | null;
  base_amount: number;
  bonus_amount: number;
  super_amount: number;
  total_amount: number;
};

export async function updateEntry(id: string, data: EntryFormData) {
  const [supabase, userId] = await Promise.all([createClient(), getAuthUserId()]);
  const { error } = await supabase
    .from("entries")
    .update({
      client_id: data.client_id,
      date: data.date,
      billing_type_snapshot: data.billing_type,
      day_type: data.day_type,
      workflow_type: data.workflow_type,
      skus: data.skus,
      brand: data.brand ?? null,
      shoot_client: data.shoot_client ?? null,
      description: data.description ?? null,
      role: data.role ?? null,
      start_time: data.start_time ?? null,
      finish_time: data.finish_time ?? null,
      break_minutes: data.break_minutes ?? null,
      hours_worked: data.hours_worked,
      base_amount: data.base_amount,
      bonus_amount: data.bonus_amount,
      super_amount: data.super_amount,
      total_amount: data.total_amount,
    })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw new Error(`updateEntry: ${error.message}`);
  updateTag(CACHE_TAGS.entries);
  refresh();
}

export async function createEntry(data: EntryFormData) {
  const [supabase, userId] = await Promise.all([createClient(), getAuthUserId()]);
  const { error } = await supabase.from("entries").insert({
    user_id: userId,
    client_id: data.client_id,
    date: data.date,
    billing_type_snapshot: data.billing_type,
    day_type: data.day_type,
    workflow_type: data.workflow_type,
    skus: data.skus,
    brand: data.brand ?? null,
    shoot_client: data.shoot_client ?? null,
    description: data.description ?? null,
    role: data.role ?? null,
    start_time: data.start_time ?? null,
    finish_time: data.finish_time ?? null,
    break_minutes: data.break_minutes ?? null,
    hours_worked: data.hours_worked,
    base_amount: data.base_amount,
    bonus_amount: data.bonus_amount,
    super_amount: data.super_amount,
    total_amount: data.total_amount,
  });

  if (error) throw new Error(`createEntry: ${error.message}`);
  updateTag(CACHE_TAGS.entries);
  refresh();
}

export async function deleteEntry(id: string) {
  const [supabase, userId] = await Promise.all([createClient(), getAuthUserId()]);
  const { error } = await supabase
    .from("entries")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw new Error(`deleteEntry: ${error.message}`);
  updateTag(CACHE_TAGS.entries);
  refresh();
}

export async function revalidateEntries() {
  updateTag(CACHE_TAGS.entries);
  updateTag(CACHE_TAGS.clients);
  refresh();
}

export async function fetchClients() {
  const [userId, token] = await Promise.all([getAuthUserId(), getAuthToken()]);
  return fetchFullClients(userId, token);
}

export async function loadWorkflowRates() {
  const token = await getAuthToken();
  return fetchWorkflowRates(token);
}
