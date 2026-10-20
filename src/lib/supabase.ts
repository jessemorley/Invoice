import { createClient } from "@supabase/supabase-js";
import { createBrowserClient } from "@supabase/ssr";
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

// Browser client: reads the session from the auth cookies @supabase/ssr sets,
// so queries carry the user's JWT and hit the same RLS policies as the server.
// createBrowserClient returns a singleton in the browser.
export function createBrowserSupabase() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
