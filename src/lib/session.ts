import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

// Resolves the signed-in user's profile from the request's Supabase session
// cookie. Returns null if not signed in or the profile row is missing.
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return (profile as Profile) ?? null;
}
