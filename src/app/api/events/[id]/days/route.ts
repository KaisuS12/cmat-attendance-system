import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { daySchema } from "@/lib/schemas";
import { parseJsonBody } from "@/lib/validation";

// Adds another day to an existing (multi-day) event.
export async function POST(request: Request, { params }: RouteContext<"/api/events/[id]/days">) {
  const { profile, error } = await requireRole("officer", "admin");
  if (error) return error;

  const { id } = await params;
  const body = await parseJsonBody(request, daySchema);
  if (body.error) return body.error;
  const day = body.data;

  const admin = createAdminClient();
  const { data, error: insertError } = await admin
    .from("event_days")
    .insert({
      event_id: id,
      day_date: day.dayDate,
      sign_in_start: day.signInStart,
      sign_in_end: day.signInEnd,
      sign_out_start: day.signOutStart,
      sign_out_end: day.signOutEnd,
    })
    .select("*")
    .single();

  if (insertError || !data) {
    const duplicate = insertError?.code === "23505";
    return NextResponse.json(
      { error: duplicate ? "This event already has a day on that date." : "Could not add the day." },
      { status: duplicate ? 409 : 500 }
    );
  }

  await logAudit({
    actorId: profile.id,
    action: "event_day_added",
    entityType: "event_days",
    entityId: data.id,
    details: { eventId: id, dayDate: day.dayDate },
  });

  return NextResponse.json({ eventDay: data }, { status: 201 });
}
