import { after, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { formatZodError } from "@/lib/validation";
import { PROOF_BUCKET, proofPhotoProblem } from "@/lib/proof-photos";

// Officer override for a student who is physically present but can't
// generate a QR (dead phone, no GPS, no signal). Requires a reason and a live
// photo of the student's ID, is flagged as manual on the record and in
// exports, and is audited.
const bodySchema = z.object({
  eventDayId: z.uuid(),
  studentProfileId: z.uuid(),
  type: z.enum(["sign_in", "sign_out"]),
  reason: z.string().trim().min(3, "Give a short reason (e.g. “phone battery dead”)."),
});

export async function POST(request: Request) {
  const { profile, error } = await requireRole("officer", "admin");
  if (error) return error;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    // Most likely a page opened before ID photos were required.
    return NextResponse.json({ error: "Refresh the page and try again." }, { status: 400 });
  }
  const body = bodySchema.safeParse({
    eventDayId: form.get("eventDayId"),
    studentProfileId: form.get("studentProfileId"),
    type: form.get("type"),
    reason: form.get("reason"),
  });
  if (!body.success) return NextResponse.json({ error: formatZodError(body.error) }, { status: 400 });
  const { eventDayId, studentProfileId, type, reason } = body.data;

  const photo = form.get("photo");
  const photoBytes = photo instanceof Blob ? new Uint8Array(await photo.arrayBuffer()) : new Uint8Array();
  const photoProblem = proofPhotoProblem(photoBytes);
  if (photoProblem) return NextResponse.json({ error: photoProblem }, { status: 400 });

  const admin = createAdminClient();

  const [{ data: student }, { data: eventDay }] = await Promise.all([
    admin
      .from("profiles")
      .select("*")
      .eq("id", studentProfileId)
      .single(),
    admin.from("event_days").select("id, sign_out_required").eq("id", eventDayId).single(),
  ]);

  if (!student || student.role !== "student") {
    return NextResponse.json({ error: "Student not found." }, { status: 404 });
  }
  if (type === "sign_out" && eventDay && eventDay.sign_out_required === false) {
    return NextResponse.json({ error: "This session has no sign-out. Signing in is enough." }, { status: 409 });
  }
  if (student.graduated_at) {
    return NextResponse.json({ error: "This student has graduated and no longer signs in to events." }, { status: 409 });
  }
  if (!eventDay) {
    return NextResponse.json({ error: "Event day not found." }, { status: 404 });
  }

  const alreadyRecorded = () =>
    NextResponse.json(
      { error: `${student.full_name} already has a ${type === "sign_in" ? "sign-in" : "sign-out"} for this day.` },
      { status: 409 }
    );

  // Checked before uploading, so a repeat entry leaves no stray photo behind.
  const { data: existing } = await admin
    .from("attendance_records")
    .select("id")
    .eq("event_day_id", eventDayId)
    .eq("student_id", studentProfileId)
    .eq("type", type)
    .is("voided_at", null)
    .maybeSingle();
  if (existing) return alreadyRecorded();

  const photoPath = `${eventDayId}/${crypto.randomUUID()}.jpg`;
  const { error: uploadError } = await admin.storage
    .from(PROOF_BUCKET)
    .upload(photoPath, photoBytes, { contentType: "image/jpeg" });
  if (uploadError) {
    return NextResponse.json({ error: "Could not save the ID photo. Nothing was recorded. Try again." }, { status: 500 });
  }

  const { data: record, error: insertError } = await admin
    .from("attendance_records")
    .insert({
      event_day_id: eventDayId,
      student_id: studentProfileId,
      type,
      method: "manual",
      manual_reason: reason,
      proof_photo_path: photoPath,
      scanned_by: profile.id,
    })
    .select("id, recorded_at")
    .single();

  if (insertError || !record) {
    await admin.storage.from(PROOF_BUCKET).remove([photoPath]);
    if (insertError?.code === "23505") return alreadyRecorded();
    return NextResponse.json({ error: "Could not record attendance." }, { status: 500 });
  }

  // Audit write happens after the response so the officer isn't kept waiting.
  after(() =>
    logAudit({
      actorId: profile.id,
      action: "attendance_manual_entry",
      entityType: "attendance_records",
      entityId: record.id,
      details: { studentId: studentProfileId, studentName: student.full_name, eventDayId, type, reason, hasPhoto: true },
    })
  );

  return NextResponse.json({
    student: {
      full_name: student.full_name,
      student_id: student.student_id,
      program: student.program,
      year_level: student.year_level,
      section: student.section,
    },
    type,
    recordedAt: record.recorded_at,
  });
}
