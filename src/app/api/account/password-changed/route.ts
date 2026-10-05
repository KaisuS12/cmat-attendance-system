import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

// Called by the change-password page after supabase.auth.updateUser succeeds.
// Clears the forced-change flag; the flag lives on profiles, which clients
// can't write under RLS, so this needs the service role.
export async function POST() {
  const { profile, error } = await requireRole();
  if (error) return error;

  const admin = createAdminClient();
  const { error: updateError } = await admin
    .from("profiles")
    .update({ must_change_password: false })
    .eq("id", profile.id);

  if (updateError) {
    return NextResponse.json({ error: "Could not update your account." }, { status: 500 });
  }

  await logAudit({
    actorId: profile.id,
    action: "password_changed",
    entityType: "profiles",
    entityId: profile.id,
  });

  return NextResponse.json({ ok: true });
}
