import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

// "Reset phones" for a student with a new or lost phone: forgets every phone
// on their account, so the next phone they log in on is accepted.
export async function DELETE(_request: Request, { params }: RouteContext<"/api/users/[id]/devices">) {
  const { profile, error } = await requireRole("officer", "admin");
  if (error) return error;

  const { id } = await params;
  const admin = createAdminClient();
  const { data: student } = await admin.from("profiles").select("id, role, full_name").eq("id", id).single();
  if (!student || student.role !== "student") {
    return NextResponse.json({ error: "Student not found." }, { status: 404 });
  }

  const { error: deleteError, count } = await admin
    .from("student_devices")
    .delete({ count: "exact" })
    .eq("profile_id", id);
  if (deleteError) return NextResponse.json({ error: "Could not reset phones." }, { status: 500 });

  await logAudit({
    actorId: profile.id,
    action: "student_devices_reset",
    entityType: "profiles",
    entityId: id,
    details: { fullName: student.full_name, phonesForgotten: count ?? 0 },
  });
  return NextResponse.json({ reset: count ?? 0 });
}
