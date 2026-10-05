import { after, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { distanceMeters } from "@/lib/geofence";
import { describeTargets, isEventForStudent, type EventTargets } from "@/lib/eligibility";
import { signQrToken, QR_TOKEN_TTL_MS } from "@/lib/tokens";
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
// Each code lasts 60s, so a student never needs more than a few per minute;
// more than this is a stuck button or someone hammering the endpoint.
const MAX_TOKENS_PER_MINUTE = 6;

export async function POST(request: Request) {
  const { profile, error: authError } = await requireRole("student");
  if (authError) return authError;

  const body = await parseJsonBody(request, bodySchema);
  if (body.error) return body.error;
  const { eventDayId, type, latitude, longitude, accuracy } = body.data;

  const admin = createAdminClient();
  const now = new Date();

  // These three lookups don't depend on each other — run them together so a
  // sign-in costs one database round trip instead of three.
  const [{ count: recentTokens }, { data: eventDay }, { data: existing }] = await Promise.all([
    admin
      .from("qr_tokens")
      .select("id", { count: "exact", head: true })
      .eq("student_id", profile.id)
      .gte("created_at", new Date(now.getTime() - 60_000).toISOString()),
    admin
      .from("event_days")
      .select("*, events!inner(venue_id, target_programs, target_year_levels, venues!inner(*))")
      .eq("id", eventDayId)
      .single<EventDay & { events: EventTargets & { venue_id: string; venues: Venue } }>(),
    admin
      .from("attendance_records")
      .select("id")
      .eq("event_day_id", eventDayId)
      .eq("student_id", profile.id)
      .eq("type", type)
      .is("voided_at", null)
      .maybeSingle(),
  ]);

  if ((recentTokens ?? 0) >= MAX_TOKENS_PER_MINUTE) {
    return NextResponse.json(
      { error: "Too many codes generated. Wait a moment and try again." },
      { status: 429 }
    );
  }

  if (!eventDay) {
    return NextResponse.json({ error: "Event day not found." }, { status: 404 });
  }

  if (!isEventForStudent(eventDay.events, profile)) {
    return NextResponse.json(
      { error: `This event is only for ${describeTargets(eventDay.events)}.` },
      { status: 403 }
    );
  }

  const venue = eventDay.events.venues;
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

  if (existing) {
    return NextResponse.json(
      { error: `You have already ${type === "sign_in" ? "signed in" : "signed out"} for this day.` },
      { status: 409 }
    );
  }

  // Housekeeping: drop this student's own expired, never-scanned codes so
  // qr_tokens doesn't grow forever. Runs after the response is sent, so it
  // never slows the student down.
  after(async () => {
    await admin
      .from("qr_tokens")
      .delete()
      .eq("student_id", profile.id)
      .is("used_at", null)
      .lt("expires_at", new Date(now.getTime() - 10 * 60_000).toISOString());
  });

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

  // Not audit-logged: students generate thousands of codes per event, which
  // would bury the officer/admin actions the audit log exists for. The token
  // row itself (with issue location) is the record.

  return NextResponse.json({ token, issuedAt: now.toISOString(), expiresAt: expiresAt.toISOString() });
}
