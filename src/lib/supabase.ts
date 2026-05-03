import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// Creates an anon-key client authenticated with the user's JWT token.
// Used in "use cache" query functions where cookies() cannot be called.
export function createTokenClient(token: string) {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
    }
  );
}
