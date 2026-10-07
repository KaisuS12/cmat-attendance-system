import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { parseJsonBody } from "@/lib/validation";

const bodySchema = z.object({ role: z.enum(["officer", "admin"]) });

// Promote an officer to admin, or turn an admin back into an officer.
// Students can't be promoted here, and nobody can change their own role, so
// the system can never be left without an admin by accident.
export async function PATCH(request: Request, { params }: RouteContext<"/api/users/[id]/role">) {
  const { profile, error } = await requireRole("admin");
  if (error) return error;

  const { id } = await params;
  const body = await parseJsonBody(request, bodySchema);
  if (body.error) return body.error;
  const { role } = body.data;

  if (id === profile.id) {
    return NextResponse.json({ error: "You can't change your own role. Ask another admin." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: target } = await admin.from("profiles").select("id, role, full_name, email").eq("id", id).single();
  if (!target) return NextResponse.json({ error: "Account not found." }, { status: 404 });
  if (target.role === "student") {
    return NextResponse.json({ error: "Student accounts can't be made officers or admins." }, { status: 400 });
  }
  if (target.role === role) return NextResponse.json({ ok: true });

  const { error: updateError } = await admin.from("profiles").update({ role }).eq("id", id);
  if (updateError) return NextResponse.json({ error: "Could not change the role." }, { status: 500 });

  await logAudit({
    actorId: profile.id,
    action: "role_changed",
    entityType: "profiles",
    entityId: id,
    details: { fullName: target.full_name, email: target.email, from: target.role, to: role },
  });

  return NextResponse.json({ ok: true });
}
