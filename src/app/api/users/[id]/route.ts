import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

// Removes an old officer account. An account that never did anything
// (no events, scans, voids, password resets or other logged actions) is
// deleted for good. One with history can't be: their name must stay on the
// records they touched, so it's deactivated instead and moves to "Former
// officers" on the Staff page.
export async function DELETE(_request: Request, { params }: RouteContext<"/api/users/[id]">) {
  const { profile, error } = await requireRole("admin");
  if (error) return error;

  const { id } = await params;
  if (id === profile.id) {
    return NextResponse.json({ error: "You can't remove your own account." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: target } = await admin.from("profiles").select("id, role, full_name, email").eq("id", id).single();
  if (!target) return NextResponse.json({ error: "Account not found." }, { status: 404 });
  if (target.role === "admin") {
    return NextResponse.json({ error: "Make them an officer first, then remove them." }, { status: 403 });
  }
  if (target.role !== "officer") {
    return NextResponse.json({ error: "Only officer accounts can be removed here." }, { status: 403 });
  }

  const count = async (table: string, column: string) => {
    const { count: n } = await admin.from(table).select("*", { count: "exact", head: true }).eq(column, id);
    return n ?? 0;
  };
  const uses = await Promise.all([
    count("events", "created_by"),
    count("attendance_records", "scanned_by"),
    count("attendance_records", "voided_by"),
    count("audit_log", "actor_id"),
    count("temp_passwords", "issued_by"),
  ]);
  const hasHistory = uses.some((n) => n > 0);

  if (!hasHistory) {
    const { error: deleteError } = await admin.auth.admin.deleteUser(id); // cascades to the profile
    if (deleteError) return NextResponse.json({ error: "Could not remove the account." }, { status: 500 });
    await logAudit({
      actorId: profile.id,
      action: "staff_deleted",
      entityType: "profiles",
      details: { fullName: target.full_name, email: target.email },
    });
    return NextResponse.json({ result: "deleted" });
  }

  // Same as Deactivate: the ban blocks logins, is_active ends any session.
  const { error: banError } = await admin.auth.admin.updateUserById(id, { ban_duration: "876000h" });
  if (banError) return NextResponse.json({ error: "Could not remove the account." }, { status: 500 });
  await admin.from("profiles").update({ is_active: false }).eq("id", id);
  await logAudit({
    actorId: profile.id,
    action: "account_deactivated",
    entityType: "profiles",
    entityId: id,
    details: { fullName: target.full_name, role: target.role, removed: true },
  });
  return NextResponse.json({ result: "archived" });
}
