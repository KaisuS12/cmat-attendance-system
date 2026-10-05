import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { parseJsonBody } from "@/lib/validation";

const bodySchema = z.object({ active: z.boolean() });

// Deactivate / reactivate an account. Accounts are never deleted: their
// attendance and audit history must stay attributable.
export async function PATCH(request: Request, { params }: RouteContext<"/api/users/[id]/status">) {
  const { profile, error } = await requireRole("admin");
  if (error) return error;

  const { id } = await params;
  const body = await parseJsonBody(request, bodySchema);
  if (body.error) return body.error;
  const { active } = body.data;

  if (id === profile.id) {
    return NextResponse.json({ error: "You can't deactivate your own account." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: target } = await admin.from("profiles").select("id, role, full_name").eq("id", id).single();
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });
  if (target.role === "admin") {
    return NextResponse.json({ error: "Admin accounts can't be deactivated from here." }, { status: 403 });
  }

  // The ban blocks new logins and session refreshes; is_active is what the
  // proxy and API routes check, so an existing session stops working at once.
  const { error: authError } = await admin.auth.admin.updateUserById(id, {
    ban_duration: active ? "none" : "876000h",
  });
  if (authError) {
    return NextResponse.json({ error: "Could not update the account." }, { status: 500 });
  }

  await admin.from("profiles").update({ is_active: active }).eq("id", id);

  await logAudit({
    actorId: profile.id,
    action: active ? "account_reactivated" : "account_deactivated",
    entityType: "profiles",
    entityId: id,
    details: { fullName: target.full_name, role: target.role },
  });

  return NextResponse.json({ ok: true });
}
