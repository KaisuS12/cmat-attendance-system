import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { cleanTargets } from "@/lib/eligibility";
import { parseJsonBody } from "@/lib/validation";

export async function GET(_request: Request, { params }: RouteContext<"/api/events/[id]">) {
  const { error } = await requireRole();
  if (error) return error;

  const { id } = await params;
  const admin = createAdminClient();
  const { data, error: queryError } = await admin
    .from("events")
    .select("*, venues(*), event_days(*)")
    .eq("id", id)
    .single();

  if (queryError || !data) return NextResponse.json({ error: "Event not found." }, { status: 404 });
  return NextResponse.json({ event: data });
}

const patchSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").optional(),
  description: z.string().trim().nullable().optional(),
  venueId: z.uuid().optional(),
  targetPrograms: z.array(z.string()).max(50).optional(),
  targetYearLevels: z.array(z.string()).max(20).optional(),
});

// Edit an event's details after creation: title, description, venue (pick
// another saved venue) and who should attend. Day windows are edited per day.
export async function PATCH(request: Request, { params }: RouteContext<"/api/events/[id]">) {
  const { profile, error } = await requireRole("officer", "admin");
  if (error) return error;

  const { id } = await params;
  const body = await parseJsonBody(request, patchSchema);
  if (body.error) return body.error;
  const b = body.data;

  const changes: Record<string, unknown> = {};
  if (b.title !== undefined) changes.title = b.title;
  if (b.description !== undefined) changes.description = b.description || null;
  if (b.venueId !== undefined) changes.venue_id = b.venueId;
  if (b.targetPrograms !== undefined) changes.target_programs = cleanTargets(b.targetPrograms);
  if (b.targetYearLevels !== undefined) changes.target_year_levels = cleanTargets(b.targetYearLevels);

  const admin = createAdminClient();
  const { data: before } = await admin
    .from("events")
    .select("title, description, venue_id, target_programs, target_year_levels")
    .eq("id", id)
    .single();
  if (!before) return NextResponse.json({ error: "Event not found." }, { status: 404 });

  const { error: updateError } = await admin
    .from("events")
    .update({ ...changes, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (updateError) {
    return NextResponse.json(
      { error: updateError.code === "23503" ? "That venue no longer exists." : "Could not update the event." },
      { status: updateError.code === "23503" ? 400 : 500 }
    );
  }

  await logAudit({
    actorId: profile.id,
    action: "event_updated",
    entityType: "events",
    entityId: id,
    details: { before, after: changes },
  });

  return NextResponse.json({ ok: true });
}

// Only events with no attendance can be deleted — once anyone has been
// recorded, the event is part of their clearance record.
export async function DELETE(_request: Request, { params }: RouteContext<"/api/events/[id]">) {
  const { profile, error } = await requireRole("officer", "admin");
  if (error) return error;

  const { id } = await params;
  const admin = createAdminClient();

  const { data: event } = await admin
    .from("events")
    .select("id, title, event_days(id)")
    .eq("id", id)
    .single();
  if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });

  const dayIds = (event.event_days as { id: string }[]).map((d) => d.id);
  if (dayIds.length > 0) {
    const { count } = await admin
      .from("attendance_records")
      .select("id", { count: "exact", head: true })
      .in("event_day_id", dayIds);
    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: "This event already has attendance records and can't be deleted." },
        { status: 409 }
      );
    }
  }

  const { error: deleteError } = await admin.from("events").delete().eq("id", id);
  if (deleteError) {
    return NextResponse.json({ error: "Could not delete event." }, { status: 500 });
  }

  await logAudit({
    actorId: profile.id,
    action: "event_deleted",
    entityType: "events",
    entityId: id,
    details: { title: event.title },
  });

  return NextResponse.json({ ok: true });
}
