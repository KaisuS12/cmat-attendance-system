import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { parseJsonBody } from "@/lib/validation";

const bodySchema = z.object({ active: z.literal(true) });

// Makes this the active semester (the RPC deactivates the others atomically).
export async function PATCH(request: Request, { params }: RouteContext<"/api/semesters/[id]">) {
  const { profile, error } = await requireRole("admin");
  if (error) return error;

  const { id } = await params;
  const body = await parseJsonBody(request, bodySchema);
  if (body.error) return body.error;

  const admin = createAdminClient();
  const { error: rpcError } = await admin.rpc("set_active_semester", { p_id: id });
  if (rpcError) {
    return NextResponse.json({ error: "Could not set the active semester." }, { status: 500 });
  }

  await logAudit({
    actorId: profile.id,
    action: "semester_activated",
    entityType: "semesters",
    entityId: id,
  });

  return NextResponse.json({ ok: true });
}
