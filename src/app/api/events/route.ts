import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("events")
    .select("*, venues(*), event_days(*)")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ events: data });
}

const daySchema = z.object({
  dayDate: z.string(),
  signInStart: z.string(),
  signInEnd: z.string(),
  signOutStart: z.string(),
  signOutEnd: z.string(),
});

const venueSchema = z.union([
  z.object({ venueId: z.string().uuid() }),
  z.object({
    name: z.string().min(1),
    latitude: z.number(),
    longitude: z.number(),
    radiusMeters: z.number().int().positive().default(150),
  }),
]);

const bodySchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  semesterId: z.string().uuid().optional(),
  venue: venueSchema,
  days: z.array(daySchema).min(1),
});

export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "officer" && profile.role !== "admin")) {
    return NextResponse.json({ error: "Officers only." }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const { title, description, semesterId, venue, days } = parsed.data;

  const admin = createAdminClient();

  let venueId: string;
  if ("venueId" in venue) {
    venueId = venue.venueId;
  } else {
    const { data: newVenue, error: venueError } = await admin
      .from("venues")
      .insert({
        name: venue.name,
        latitude: venue.latitude,
        longitude: venue.longitude,
        radius_meters: venue.radiusMeters,
      })
      .select("id")
      .single();
    if (venueError || !newVenue) {
      return NextResponse.json({ error: "Could not create venue." }, { status: 500 });
    }
    venueId = newVenue.id;
  }

  const { data: event, error: eventError } = await admin
    .from("events")
    .insert({
      title,
      description,
      venue_id: venueId,
      semester_id: semesterId ?? null,
      created_by: profile.id,
    })
    .select("id")
    .single();

  if (eventError || !event) {
    return NextResponse.json({ error: "Could not create event." }, { status: 500 });
  }

  const { error: daysError } = await admin.from("event_days").insert(
    days.map((day) => ({
      event_id: event.id,
      day_date: day.dayDate,
      sign_in_start: day.signInStart,
      sign_in_end: day.signInEnd,
      sign_out_start: day.signOutStart,
      sign_out_end: day.signOutEnd,
    }))
  );

  if (daysError) {
    return NextResponse.json({ error: "Could not create event days." }, { status: 500 });
  }

  await logAudit({
    actorId: profile.id,
    action: "event_created",
    entityType: "events",
    entityId: event.id,
    details: { title, dayCount: days.length },
  });

  return NextResponse.json({ eventId: event.id }, { status: 201 });
}
