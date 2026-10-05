import type { SupabaseClient } from "@supabase/supabase-js";

// Remember a student's issued temporary password so officers can look it up
// until the student sets their own (see migration 0005). Never throws: the
// account works either way, the password just won't be viewable later.
export async function rememberTempPassword(
  admin: SupabaseClient,
  profileId: string,
  password: string,
  issuedBy: string
): Promise<void> {
  await admin
    .from("temp_passwords")
    .upsert({ profile_id: profileId, password, issued_by: issuedBy, issued_at: new Date().toISOString() });
}

export async function forgetTempPassword(admin: SupabaseClient, profileId: string): Promise<void> {
  await admin.from("temp_passwords").delete().eq("profile_id", profileId);
}
