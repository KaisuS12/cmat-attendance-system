import { cache } from "react";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/types/database";

// Resolves the signed-in user's profile from the request's Supabase session
// cookie. Returns null if not signed in or the profile row is missing.
// Cached per request, so a layout and page asking for it cost one lookup.
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  // getClaims verifies the JWT (locally when the project uses asymmetric
  // signing keys) instead of always calling the Auth server like getUser.
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;

  if (!userId) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  return (profile as Profile) ?? null;
});

// Route-handler guard: returns the profile if the caller is an active user
// with one of the given roles, otherwise a ready-to-return error response.
export async function requireRole(
  ...roles: UserRole[]
): Promise<{ profile: Profile; error?: never } | { profile?: never; error: NextResponse }> {
  const profile = await getCurrentProfile();
  if (!profile) {
    return { error: NextResponse.json({ error: "Not signed in." }, { status: 401 }) };
  }
  // Strict check: a database without migration 0002 has no is_active column.
  if (profile.is_active === false) {
    return { error: NextResponse.json({ error: "This account is deactivated." }, { status: 403 }) };
  }
  if (roles.length > 0 && !roles.includes(profile.role)) {
    // Most often seen when another tab in the same browser logged into a
    // different account: this page still shows the old screens, but requests
    // now carry the new account's session.
    return {
      error: NextResponse.json(
        {
          error:
            "Your account doesn't have access to this. If you logged into a different account in another tab, refresh this page.",
        },
        { status: 403 }
      ),
    };
  }
  return { profile };
}
