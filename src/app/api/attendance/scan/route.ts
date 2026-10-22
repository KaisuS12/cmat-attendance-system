import { after, NextResponse } from "next/server";
import { z } from "zod";
import * as jose from "jose";
import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyQrToken } from "@/lib/tokens";
import { logAudit } from "@/lib/audit";

const bodySchema = z.object({ token: z.string(), eventDayId: z.string().uuid().optional() });

export async function POST(request: Request) {
  const { profile, error: authError } = await requireRole("officer", "admin");
  if (authError) return authError;

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

  const admin = createAdminClient();
  const fail = (error: string, status: number, code?: string) =>
    NextResponse.json(code ? { error, code } : { error }, { status });
  const alreadyRecorded = (type: string) =>
    fail(`Already ${type === "sign_in" ? "signed in" : "signed out"} for this day.`, 409, "already_recorded");

  // One round trip: record_scan (migration 0007) looks up, claims and
  // records in a single transaction.
  const { data: scan, error: rpcError } = await admin.rpc("record_scan", {
    p_jti: payload.jti,
    p_event_day_id: parsed.data.eventDayId ?? null,
    p_officer: profile.id,
  });

  if (!rpcError && scan) {
    const result = scan as {
      status: "invalid" | "wrong_event" | "used_or_expired" | "already_recorded" | "recorded";
      type?: string;
      record_id?: string;
      recorded_at?: string;
      student_profile_id?: string;
      student?: Record<string, string | null>;
    };
    if (result.status === "invalid") return fail("Invalid QR code.", 400);
    if (result.status === "wrong_event") return fail("This QR code was issued for a different event.", 400);
    if (result.status === "used_or_expired") return fail("This QR code has already been used or has expired.", 409);
    if (result.status === "already_recorded") return alreadyRecorded(result.type ?? "");

    after(() =>
      logAudit({
        actorId: profile.id,
        action: "attendance_scanned",
        entityType: "attendance_records",
        entityId: result.record_id,
        details: { studentId: result.student_profile_id, type: result.type },
      })
    );
    return NextResponse.json({ student: result.student, type: result.type, recordedAt: result.recorded_at });
  }

  // The function isn't installed yet (migration 0007 not run): the same
  // steps, one call at a time.
  if (rpcError && rpcError.code !== "PGRST202") {
    return fail("Could not record the scan. Try again.", 500);
  }

  // The signed token only carries the row id; who/which day/which type are
  // read from the row the server stored when it issued the code.
  const { data: token } = await admin
    .from("qr_tokens")
    .select("id, student_id, event_day_id, type")
    .eq("id", payload.jti)
    .maybeSingle();
  if (!token) {
    return NextResponse.json({ error: "Invalid QR code." }, { status: 400 });
  }

  // Checked before claiming, so scanning at the wrong event's scanner doesn't
  // use up the student's code.
  if (parsed.data.eventDayId && parsed.data.eventDayId !== token.event_day_id) {
    return NextResponse.json(
      { error: "This QR code was issued for a different event." },
      { status: 400 }
    );
  }

  // Atomically claim the token: only succeeds if it hasn't been used yet.
  const { data: claimedToken, error: claimError } = await admin
    .from("qr_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", token.id)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("id")
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
      event_day_id: token.event_day_id,
      student_id: token.student_id,
      type: token.type,
      qr_token_id: token.id,
      scanned_by: profile.id,
    })
    .select("id, recorded_at")
    .single();

  if (insertError || !record) {
    return NextResponse.json(
      {
        error: `Already ${token.type === "sign_in" ? "signed in" : "signed out"} for this day.`,
        code: "already_recorded",
      },
      { status: 409 }
    );
  }

  const { data: student } = await admin
    .from("profiles")
    .select("full_name, student_id, program, year_level, section")
    .eq("id", token.student_id)
    .single();

  // Audit write happens after the response so the officer sees the name sooner.
  after(() =>
    logAudit({
      actorId: profile.id,
      action: "attendance_scanned",
      entityType: "attendance_records",
      entityId: record.id,
      details: { studentId: token.student_id, type: token.type },
    })
  );

  return NextResponse.json({
    student,
    type: token.type,
    recordedAt: record.recorded_at,
  });
}
