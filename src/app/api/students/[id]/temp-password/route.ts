import { after, NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

// The temporary password issued to a student who hasn't set their own yet,
// so an officer can tell them how to log in. Every view is audited.
export async function GET(_request: Request, { params }: RouteContext<"/api/students/[id]/temp-password">) {
  const { profile, error } = await requireRole("officer", "admin");
  if (error) return error;

  const { id } = await params;
  const admin = createAdminClient();

  const [{ data: student }, { data: temp }] = await Promise.all([
    admin.from("profiles").select("role, full_name, must_change_password").eq("id", id).single(),
    admin.from("temp_passwords").select("password").eq("profile_id", id).maybeSingle(),
  ]);

  if (!student || student.role !== "student") {
    return NextResponse.json({ error: "Student not found." }, { status: 404 });
  }
  if (!student.must_change_password) {
    return NextResponse.json(
      { error: "This student has set their own password. Use Reset password if they forgot it." },
      { status: 404 }
    );
  }
  if (!temp) {
    return NextResponse.json(
      { error: "This temporary password wasn't saved. Use Reset password to issue a new one." },
      { status: 404 }
    );
  }

  after(() =>
    logAudit({
      actorId: profile.id,
      action: "temp_password_viewed",
      entityType: "profiles",
      entityId: id,
      details: { studentName: student.full_name },
    })
  );

  return NextResponse.json({ password: temp.password });
}
