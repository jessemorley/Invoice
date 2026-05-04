import { createClient } from "./supabase-server";

export async function getAuth(): Promise<{ userId: string; token: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new Error("Unauthenticated");
  return { userId: data.session.user.id, token: data.session.access_token };
}

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

export async function getAuthUser(): Promise<{ id: string; email: string; name: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Unauthenticated");
  const email = data.user.email ?? "";
  const name = (data.user.user_metadata?.full_name as string | undefined) ?? email.split("@")[0] ?? "";
  return { id: data.user.id, email, name };
}
