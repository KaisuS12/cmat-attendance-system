import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { dayPatchSchema, dayWindowProblem } from "@/lib/schemas";
import { parseJsonBody } from "@/lib/validation";

// Partial update of a single day's windows — this is what lets an officer
// extend sign-in by e.g. 15 minutes mid-event (§4.1). Because
// generate-token always reads the current row, an extension takes effect
// immediately for anyone who hasn't signed in yet — no separate "push" needed.
export async function PATCH(
  request: Request,
  { params }: RouteContext<"/api/events/[id]/days/[dayId]">
) {
  const { profile, error } = await requireRole("officer", "admin");
  if (error) return error;

  const { id, dayId } = await params;
  const body = await parseJsonBody(request, dayPatchSchema);
  if (body.error) return body.error;

  const admin = createAdminClient();
  const { data: current } = await admin
    .from("event_days")
    .select("*")
    .eq("id", dayId)
    .eq("event_id", id)
    .single();
  if (!current) return NextResponse.json({ error: "Event day not found." }, { status: 404 });

  const merged = {
    signInStart: body.data.signInStart ?? current.sign_in_start,
    signInEnd: body.data.signInEnd ?? current.sign_in_end,
    signOutStart: body.data.signOutStart ?? current.sign_out_start,
    signOutEnd: body.data.signOutEnd ?? current.sign_out_end,
  };
  const problem = dayWindowProblem(merged);
  if (problem) return NextResponse.json({ error: problem.message }, { status: 400 });

  const updates = {
    sign_in_start: merged.signInStart,
    sign_in_end: merged.signInEnd,
    sign_out_start: merged.signOutStart,
    sign_out_end: merged.signOutEnd,
    updated_at: new Date().toISOString(),
  };

  const { data, error: updateError } = await admin
    .from("event_days")
    .update(updates)
    .eq("id", dayId)
    .select("*")
    .single();

  if (updateError || !data) {
    return NextResponse.json({ error: "Could not update event day." }, { status: 500 });
  }

  await logAudit({
    actorId: profile.id,
    action: "event_day_window_updated",
    entityType: "event_days",
    entityId: dayId,
    details: {
      before: {
        sign_in_start: current.sign_in_start,
        sign_in_end: current.sign_in_end,
        sign_out_start: current.sign_out_start,
        sign_out_end: current.sign_out_end,
      },
      after: updates,
    },
  });

  return NextResponse.json({ eventDay: data });
}
