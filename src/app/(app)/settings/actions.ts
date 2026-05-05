"use server";

import { updateTag, refresh } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import { getAuth, getAuthUserId } from "@/lib/auth";
import {
  fetchBusinessDetails,
  fetchInvoiceSequence,
  fetchUserPreferences,
  CACHE_TAGS,
  type BusinessDetails,
  type InvoiceSequence,
  type UserPreferences,
} from "@/lib/queries";

export type BusinessDetailsFormData = {
  name: string;
  business_name: string;
  abn: string;
  address: string;
  suburb: string;
  email: string;
  super_fund: string;
  super_fund_abn: string;
  super_usi: string;
  super_member_number: string;
  bsb: string;
  account_number: string;
};

export type InvoicingFormData = {
  invoice_prefix: string;
  next_invoice_number: number;
  due_date_offset: number;
};

export type EmailFormData = {
  mark_as_issued_on_send: boolean;
  bcc_self: boolean;
};

export async function fetchSettings(): Promise<{
  businessDetails: BusinessDetails | null;
  invoiceSequence: InvoiceSequence | null;
  userPreferences: UserPreferences | null;
}> {
  const { userId, token } = await getAuth();
  const [businessDetails, invoiceSequence, userPreferences] = await Promise.all([
    fetchBusinessDetails(userId, token),
    fetchInvoiceSequence(userId, token),
    fetchUserPreferences(userId, token),
  ]);
  return { businessDetails, invoiceSequence, userPreferences };
}

export async function saveBusinessDetails(data: BusinessDetailsFormData) {
  const [supabase, userId] = await Promise.all([createClient(), getAuthUserId()]);
  const { error } = await supabase
    .from("business_details")
    .upsert(
      {
        user_id: userId,
        name: data.name,
        business_name: data.business_name,
        abn: data.abn,
        address: data.address,
        suburb: data.suburb,
        email: data.email,
        super_fund: data.super_fund,
        super_fund_abn: data.super_fund_abn,
        super_usi: data.super_usi,
        super_member_number: data.super_member_number,
        bsb: data.bsb,
        account_number: data.account_number,
      },
      { onConflict: "user_id" }
    );
  if (error) throw new Error(`saveBusinessDetails: ${error.message}`);
  updateTag(CACHE_TAGS.settings);
  refresh();
}

export async function saveInvoicingSettings(data: InvoicingFormData) {
  const [supabase, userId] = await Promise.all([createClient(), getAuthUserId()]);
  const { error } = await supabase
    .from("invoice_sequence")
    .upsert(
      {
        user_id: userId,
        invoice_prefix: data.invoice_prefix,
        last_number: data.next_invoice_number - 1,
        due_date_offset: data.due_date_offset,
      },
      { onConflict: "user_id" }
    );
  if (error) throw new Error(`saveInvoicingSettings: ${error.message}`);
  updateTag(CACHE_TAGS.settings);
  refresh();
}

export async function saveEmailSettings(data: EmailFormData) {
  const [supabase, userId] = await Promise.all([createClient(), getAuthUserId()]);
  const { error } = await supabase
    .from("user_preferences")
    .upsert({ user_id: userId, bcc_self: data.bcc_self, mark_as_issued_on_send: data.mark_as_issued_on_send }, { onConflict: "user_id" });
  if (error) throw new Error(`saveEmailSettings: ${error.message}`);
  updateTag(CACHE_TAGS.settings);
  refresh();
}
