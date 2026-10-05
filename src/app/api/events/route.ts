import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { daySchema } from "@/lib/schemas";
import { cleanTargets } from "@/lib/eligibility";
import { parseJsonBody } from "@/lib/validation";

export async function GET() {
  const { error } = await requireRole();
  if (error) return error;

  const admin = createAdminClient();
  const { data, error: queryError } = await admin
    .from("events")
    .select("*, venues(*), event_days(*)")
    .order("created_at", { ascending: false });

  if (queryError) return NextResponse.json({ error: queryError.message }, { status: 500 });
  return NextResponse.json({ events: data });
}

const venueSchema = z.union([
  z.object({ venueId: z.uuid() }),
  z.object({
    name: z.string().trim().min(1, "Venue name is required."),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    radiusMeters: z.number().int().min(20, "Radius must be at least 20 m.").max(2000).default(150),
  }),
]);

const bodySchema = z
  .object({
    title: z.string().trim().min(1, "Title is required."),
    description: z.string().trim().optional(),
    semesterId: z.uuid().optional(),
    venue: venueSchema,
    days: z.array(daySchema).min(1, "Add at least one day."),
    targetPrograms: z.array(z.string()).max(50).optional(),
    targetYearLevels: z.array(z.string()).max(20).optional(),
  })
  .refine((b) => new Set(b.days.map((d) => d.dayDate)).size === b.days.length, {
    path: ["days"],
    message: "Each day must have a different date.",
  });

export async function POST(request: Request) {
  const { profile, error } = await requireRole("officer", "admin");
  if (error) return error;

  const body = await parseJsonBody(request, bodySchema);
  if (body.error) return body.error;
  const { title, description, venue, days } = body.data;
  const targetPrograms = cleanTargets(body.data.targetPrograms);
  const targetYearLevels = cleanTargets(body.data.targetYearLevels);

  const admin = createAdminClient();

  // New events belong to the active semester unless one is given, so
  // semester exports and student history pick them up automatically.
  let semesterId = body.data.semesterId ?? null;
  if (!semesterId) {
    const { data: active } = await admin.from("semesters").select("id").eq("is_active", true).maybeSingle();
    semesterId = active?.id ?? null;
  }

  const { data: eventId, error: rpcError } = await admin.rpc("create_event", {
    p_title: title,
    p_description: description || null,
    p_semester_id: semesterId,
    p_venue: venue,
    p_days: days,
    p_actor: profile.id,
    p_target_programs: targetPrograms,
    p_target_year_levels: targetYearLevels,
  });

  if (rpcError || !eventId) {
    return NextResponse.json(
      { error: rpcError?.message ?? "Could not create event." },
      { status: 500 }
    );
  }

  await logAudit({
    actorId: profile.id,
    action: "event_created",
    entityType: "events",
    entityId: eventId as string,
    details: { title, dayCount: days.length, targetPrograms, targetYearLevels },
  });

  return NextResponse.json({ eventId }, { status: 201 });
}
