import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { generateTempPassword } from "@/lib/passwords";

// Admin-issued reset for a student or officer who forgot their password.
// The new temporary password is returned once; the user must change it on
// their next login.
export async function POST(_request: Request, { params }: RouteContext<"/api/users/[id]/reset-password">) {
  const { profile, error } = await requireRole("admin");
  if (error) return error;

  const { id } = await params;
  const admin = createAdminClient();

  const { data: target } = await admin.from("profiles").select("id, role, full_name").eq("id", id).single();
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });
  if (target.role === "admin" && target.id !== profile.id) {
    return NextResponse.json({ error: "Admin passwords can't be reset from here." }, { status: 403 });
  }

  const tempPassword = generateTempPassword();
  const { error: authError } = await admin.auth.admin.updateUserById(id, { password: tempPassword });
  if (authError) {
    return NextResponse.json({ error: "Could not reset the password." }, { status: 500 });
  }

  await admin.from("profiles").update({ must_change_password: true }).eq("id", id);

  await logAudit({
    actorId: profile.id,
    action: "password_reset",
    entityType: "profiles",
    entityId: id,
    details: { fullName: target.full_name, role: target.role },
  });

  return NextResponse.json({ tempPassword });
}
