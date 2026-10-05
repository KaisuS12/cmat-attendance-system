import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { distanceMeters } from "@/lib/geofence";
import { signQrToken, QR_TOKEN_TTL_MS } from "@/lib/tokens";
import { logAudit } from "@/lib/audit";
import { parseJsonBody } from "@/lib/validation";
import type { EventDay, Venue } from "@/types/database";

const bodySchema = z.object({
  eventDayId: z.string().uuid(),
  type: z.enum(["sign_in", "sign_out"]),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  // Reported GPS accuracy (meters). Indoors — concrete gyms especially — a
  // legitimate fix can drift well past the venue edge (§5), so part of the
  // reported uncertainty is forgiven, capped so it can't widen the fence much.
  accuracy: z.number().nonnegative().optional(),
});

const MAX_ACCURACY_ALLOWANCE_METERS = 50;

export async function POST(request: Request) {
  const { profile, error: authError } = await requireRole("student");
  if (authError) return authError;

  const body = await parseJsonBody(request, bodySchema);
  if (body.error) return body.error;
  const { eventDayId, type, latitude, longitude, accuracy } = body.data;

  const admin = createAdminClient();

  const { data: eventDay } = await admin
    .from("event_days")
    .select("*, events!inner(venue_id, venues!inner(*))")
    .eq("id", eventDayId)
    .single<EventDay & { events: { venue_id: string; venues: Venue } }>();

  if (!eventDay) {
    return NextResponse.json({ error: "Event day not found." }, { status: 404 });
  }

  const venue = eventDay.events.venues;
  const now = new Date();
  const windowStart = new Date(type === "sign_in" ? eventDay.sign_in_start : eventDay.sign_out_start);
  const windowEnd = new Date(type === "sign_in" ? eventDay.sign_in_end : eventDay.sign_out_end);

  if (now < windowStart || now > windowEnd) {
    return NextResponse.json(
      { error: `The ${type === "sign_in" ? "sign-in" : "sign-out"} window is not currently open.` },
      { status: 409 }
    );
  }

  const distance = distanceMeters(latitude, longitude, venue.latitude, venue.longitude);
  const allowance = Math.min(accuracy ?? 0, MAX_ACCURACY_ALLOWANCE_METERS);
  if (distance - allowance > venue.radius_meters) {
    return NextResponse.json(
      {
        error: `You're about ${Math.round(distance)} m from ${venue.name}. You need to be within ${venue.radius_meters} m to sign ${type === "sign_in" ? "in" : "out"}.`,
        code: "out_of_range",
        distanceMeters: Math.round(distance),
        radiusMeters: venue.radius_meters,
      },
      { status: 403 }
    );
  }

  const { data: existing } = await admin
    .from("attendance_records")
    .select("id")
    .eq("event_day_id", eventDayId)
    .eq("student_id", profile.id)
    .eq("type", type)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: `You have already ${type === "sign_in" ? "signed in" : "signed out"} for this day.` },
      { status: 409 }
    );
  }

  const expiresAt = new Date(now.getTime() + QR_TOKEN_TTL_MS);

  const { data: tokenRow, error } = await admin
    .from("qr_tokens")
    .insert({
      student_id: profile.id,
      event_day_id: eventDayId,
      type,
      issued_latitude: latitude,
      issued_longitude: longitude,
      expires_at: expiresAt.toISOString(),
    })
    .select("id")
    .single();

  if (error || !tokenRow) {
    return NextResponse.json({ error: "Could not issue QR token." }, { status: 500 });
  }

  const token = await signQrToken({
    jti: tokenRow.id,
    studentId: profile.id,
    eventDayId,
    type,
  });

  await logAudit({
    actorId: profile.id,
    action: "qr_token_generated",
    entityType: "qr_tokens",
    entityId: tokenRow.id,
    details: { eventDayId, type },
  });

  return NextResponse.json({ token, issuedAt: now.toISOString(), expiresAt: expiresAt.toISOString() });
}
