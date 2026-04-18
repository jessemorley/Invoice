import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export function createServerClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  );
}

export const PROTOTYPE_USER_ID = process.env.PROTOTYPE_USER_ID!;
