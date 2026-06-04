"use server";

import { updateTag, refresh } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import { getAuthUserId } from "@/lib/auth";
import { CACHE_TAGS } from "@/lib/queries";
import type { BillingType, InvoiceStatus } from "@/lib/types";

export type ClientRolePayload = {
  id?: string;
  name: string;
  rate: number;
};

export type ClientFormData = {
  name: string;
  billing_type: BillingType;
  rate_full_day: number | null;
  rate_half_day: number | null;
  rate_hourly: number | null;
  default_start_time: string | null;
  default_finish_time: string | null;
  entry_label: string | null;
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
  roles: ClientRolePayload[];
};

export async function createClientAction(data: ClientFormData): Promise<{ id: string }> {
  const [supabase, userId] = await Promise.all([createClient(), getAuthUserId()]);
  const { roles, ...clientData } = data;
  const { data: row, error } = await supabase
    .from("clients")
    .insert({ ...clientData, user_id: userId })
    .select("id")
    .single();

  if (error) throw new Error(`createClientAction: ${error.message}`);

  if (roles.length > 0) {
    const { error: rolesError } = await supabase
      .from("client_roles")
      .insert(roles.map((r) => ({ client_id: row.id, name: r.name, rate: r.rate })));
    if (rolesError) throw new Error(`createClientAction (roles): ${rolesError.message}`);
  }

  updateTag(CACHE_TAGS.clients);
  updateTag(CACHE_TAGS.entries);
  refresh();
  return { id: row.id };
}

export async function updateClientAction(clientId: string, data: ClientFormData): Promise<void> {
  const [supabase, userId] = await Promise.all([createClient(), getAuthUserId()]);
  const { roles, ...clientData } = data;

  const { error } = await supabase
    .from("clients")
    .update(clientData)
    .eq("id", clientId)
    .eq("user_id", userId);

  if (error) throw new Error(`updateClientAction: ${error.message}`);

  // Fetch existing roles to diff
  const { data: existingRoles, error: fetchError } = await supabase
    .from("client_roles")
    .select("id")
    .eq("client_id", clientId);
  if (fetchError) throw new Error(`updateClientAction (fetch roles): ${fetchError.message}`);

  const incomingIds = new Set(roles.filter((r) => r.id).map((r) => r.id!));
  const toDelete = (existingRoles ?? []).filter((r) => !incomingIds.has(r.id));

  // Block deletion of roles that have entries referencing them
  if (toDelete.length > 0) {
    const { data: existingRoleNames } = await supabase
      .from("client_roles")
      .select("id, name")
      .in("id", toDelete.map((r) => r.id));

    for (const role of existingRoleNames ?? []) {
      const { count } = await supabase
        .from("entries")
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientId)
        .eq("role", role.name);
      if ((count ?? 0) > 0) {
        throw new Error(`Cannot remove role "${role.name}" — it has entries attached. Reassign or delete those entries first.`);
      }
    }

    const { error: deleteError } = await supabase
      .from("client_roles")
      .delete()
      .in("id", toDelete.map((r) => r.id));
    if (deleteError) throw new Error(`updateClientAction (delete roles): ${deleteError.message}`);
  }

  // Upsert new and updated roles
  if (roles.length > 0) {
    const { error: upsertError } = await supabase
      .from("client_roles")
      .upsert(
        roles.map((r) => ({ ...(r.id ? { id: r.id } : {}), client_id: clientId, name: r.name, rate: r.rate })),
        { onConflict: "id" }
      );
    if (upsertError) throw new Error(`updateClientAction (upsert roles): ${upsertError.message}`);
  }

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

// ── Workflow rates ────────────────────────────────────────────────────────────

export type WorkflowRate = {
  id: string;
  client_id: string;
  workflow: string;
  kpi: number;
  upper_limit_skus: number;
  incentive_rate_per_sku: number;
  max_bonus: number;
  is_flat_bonus: boolean;
};

export async function fetchWorkflowRates(clientId: string): Promise<WorkflowRate[]> {
  const [supabase, userId] = await Promise.all([createClient(), getAuthUserId()]);
  // Verify client belongs to user
  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .eq("user_id", userId)
    .single();
  if (!client) throw new Error("fetchWorkflowRates: client not found");

  const { data, error } = await supabase
    .from("client_workflow_rates")
    .select("*")
    .eq("client_id", clientId)
    .order("workflow");
  if (error) throw new Error(`fetchWorkflowRates: ${error.message}`);
  return data ?? [];
}

export type WorkflowRatePayload = {
  workflow: string;
  kpi: number;
  upper_limit_skus: number;
  incentive_rate_per_sku: number;
  max_bonus: number;
  is_flat_bonus: boolean;
};

export async function createWorkflowRate(clientId: string, payload: WorkflowRatePayload): Promise<WorkflowRate> {
  const [supabase, userId] = await Promise.all([createClient(), getAuthUserId()]);
  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .eq("user_id", userId)
    .single();
  if (!client) throw new Error("createWorkflowRate: client not found");

  const { data, error } = await supabase
    .from("client_workflow_rates")
    .insert({ ...payload, client_id: clientId })
    .select()
    .single();
  if (error) throw new Error(`createWorkflowRate: ${error.message}`);
  return data;
}

export async function updateWorkflowRate(rateId: string, clientId: string, payload: WorkflowRatePayload): Promise<void> {
  const [supabase, userId] = await Promise.all([createClient(), getAuthUserId()]);
  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .eq("user_id", userId)
    .single();
  if (!client) throw new Error("updateWorkflowRate: client not found");

  const { error } = await supabase
    .from("client_workflow_rates")
    .update(payload)
    .eq("id", rateId)
    .eq("client_id", clientId);
  if (error) throw new Error(`updateWorkflowRate: ${error.message}`);
}

export async function deleteWorkflowRate(rateId: string, clientId: string): Promise<void> {
  const [supabase, userId] = await Promise.all([createClient(), getAuthUserId()]);
  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .eq("user_id", userId)
    .single();
  if (!client) throw new Error("deleteWorkflowRate: client not found");

  const { error } = await supabase
    .from("client_workflow_rates")
    .delete()
    .eq("id", rateId)
    .eq("client_id", clientId);
  if (error) throw new Error(`deleteWorkflowRate: ${error.message}`);
}
