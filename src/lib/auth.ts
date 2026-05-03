import { createClient } from "./supabase-server";

export async function getAuthUserId(): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) throw new Error("Unauthenticated");
  return data.claims.sub;
}

export async function getAuthToken(): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new Error("Unauthenticated");
  return data.session.access_token;
}
