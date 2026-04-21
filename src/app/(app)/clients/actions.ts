"use server";

import { revalidateTag } from "next/cache";
import { createServerClient, PROTOTYPE_USER_ID } from "@/lib/supabase";
import { CACHE_TAGS } from "@/lib/queries";

export async function updateClientColor(clientId: string, color: string) {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("clients")
    .update({ color })
    .eq("id", clientId)
    .eq("user_id", PROTOTYPE_USER_ID);

  if (error) throw new Error(`updateClientColor: ${error.message}`);
  revalidateTag(CACHE_TAGS.clients);
  revalidateTag(CACHE_TAGS.entries);
}
