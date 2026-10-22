import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { parseJsonBody } from "@/lib/validation";

const bodySchema = z.object({ required: z.boolean() });

// "Cancel sign-out" for a late announcement ("no sign-out today"): everyone
// who signed in counts as present at once, and sign-out QR codes are refused.
// Turning it back on restores the sign-out the session had.
export async function PATCH(request: Request, { params }: RouteContext<"/api/events/[id]/days/[dayId]/sign-out">) {
  const { profile, error } = await requireRole("officer", "admin");
  if (error) return error;

  const { id, dayId } = await params;
  const body = await parseJsonBody(request, bodySchema);
  if (body.error) return body.error;

  const admin = createAdminClient();
  const { data: day, error: updateError } = await admin
    .from("event_days")
    .update({ sign_out_required: body.data.required, updated_at: new Date().toISOString() })
    .eq("id", dayId)
    .eq("event_id", id)
    .select("id, day_date, session")
    .single();
  if (updateError || !day) return NextResponse.json({ error: "Session not found." }, { status: 404 });

  await logAudit({
    actorId: profile.id,
    action: body.data.required ? "sign_out_restored" : "sign_out_cancelled",
    entityType: "event_days",
    entityId: dayId,
    details: { eventId: id, dayDate: day.day_date, session: day.session || null },
  });
  return NextResponse.json({ ok: true });
}
