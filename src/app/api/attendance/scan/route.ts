import { NextResponse } from "next/server";
import { z } from "zod";
import * as jose from "jose";
import { getCurrentProfile } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyQrToken } from "@/lib/tokens";
import { logAudit } from "@/lib/audit";

const bodySchema = z.object({ token: z.string(), eventDayId: z.string().uuid().optional() });

export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "officer" && profile.role !== "admin")) {
    return NextResponse.json({ error: "Officers only." }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  let payload;
  try {
    payload = await verifyQrToken(parsed.data.token);
  } catch (err) {
    const message =
      err instanceof jose.errors.JWTExpired ? "This QR code has expired." : "Invalid QR code.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (parsed.data.eventDayId && parsed.data.eventDayId !== payload.eventDayId) {
    return NextResponse.json(
      { error: "This QR code was issued for a different event." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Atomically claim the token: only succeeds if it hasn't been used yet.
  const { data: claimedToken, error: claimError } = await admin
    .from("qr_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", payload.jti)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("*")
    .single();

  if (claimError || !claimedToken) {
    return NextResponse.json(
      { error: "This QR code has already been used or has expired." },
      { status: 409 }
    );
  }

  const { data: record, error: insertError } = await admin
    .from("attendance_records")
    .insert({
      event_day_id: payload.eventDayId,
      student_id: payload.studentId,
      type: payload.type,
      qr_token_id: payload.jti,
      scanned_by: profile.id,
    })
    .select("id, recorded_at")
    .single();

  if (insertError || !record) {
    return NextResponse.json(
      { error: "Attendance was already recorded for this student today." },
      { status: 409 }
    );
  }

  const { data: student } = await admin
    .from("profiles")
    .select("full_name, student_id, program, year_level, section")
    .eq("id", payload.studentId)
    .single();

  await logAudit({
    actorId: profile.id,
    action: "attendance_scanned",
    entityType: "attendance_records",
    entityId: record.id,
    details: { studentId: payload.studentId, type: payload.type },
  });

  return NextResponse.json({
    student,
    type: payload.type,
    recordedAt: record.recorded_at,
  });
}
