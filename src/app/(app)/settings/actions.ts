"use server";

import { revalidateTag } from "next/cache";
import { createServerClient, PROTOTYPE_USER_ID } from "@/lib/supabase";
import {
  fetchBusinessDetails,
  fetchInvoiceSequence,
  CACHE_TAGS,
  type BusinessDetails,
  type InvoiceSequence,
} from "@/lib/queries";

export type BusinessDetailsFormData = {
  name: string;
  business_name: string;
  abn: string;
  address: string;
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
  mark_as_issued_on_send: boolean;
};

export async function fetchSettings(): Promise<{
  businessDetails: BusinessDetails | null;
  invoiceSequence: InvoiceSequence | null;
}> {
  const [businessDetails, invoiceSequence] = await Promise.all([
    fetchBusinessDetails(PROTOTYPE_USER_ID),
    fetchInvoiceSequence(PROTOTYPE_USER_ID),
  ]);
  return { businessDetails, invoiceSequence };
}

export async function saveBusinessDetails(data: BusinessDetailsFormData) {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("business_details")
    .upsert(
      {
        user_id: PROTOTYPE_USER_ID,
        name: data.name,
        business_name: data.business_name,
        abn: data.abn,
        address: data.address,
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
  revalidateTag(CACHE_TAGS.settings);
}

export async function saveInvoicingSettings(data: InvoicingFormData) {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("invoice_sequence")
    .upsert(
      {
        user_id: PROTOTYPE_USER_ID,
        invoice_prefix: data.invoice_prefix,
        last_number: data.next_invoice_number - 1,
        due_date_offset: data.due_date_offset,
        mark_as_issued_on_send: data.mark_as_issued_on_send,
      },
      { onConflict: "user_id" }
    );
  if (error) throw new Error(`saveInvoicingSettings: ${error.message}`);
  revalidateTag(CACHE_TAGS.settings);
}
