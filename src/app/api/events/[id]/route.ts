import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

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
