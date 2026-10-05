import { after, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { parseJsonBody } from "@/lib/validation";

// Officer override for a student who is physically present but can't
// generate a QR (dead phone, no GPS, no signal). Requires a reason, is
// flagged as manual on the record and in exports, and is audited.
const bodySchema = z.object({
  eventDayId: z.uuid(),
  studentProfileId: z.uuid(),
  type: z.enum(["sign_in", "sign_out"]),
  reason: z.string().trim().min(3, "Give a short reason (e.g. “phone battery dead”)."),
});

export async function POST(request: Request) {
  const { profile, error } = await requireRole("officer", "admin");
  if (error) return error;

  const body = await parseJsonBody(request, bodySchema);
  if (body.error) return body.error;
  const { eventDayId, studentProfileId, type, reason } = body.data;

  const admin = createAdminClient();

  const [{ data: student }, { data: eventDay }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, full_name, student_id, program, year_level, section, role")
      .eq("id", studentProfileId)
      .single(),
    admin.from("event_days").select("id").eq("id", eventDayId).single(),
  ]);

  if (!student || student.role !== "student") {
    return NextResponse.json({ error: "Student not found." }, { status: 404 });
  }
  if (!eventDay) {
    return NextResponse.json({ error: "Event day not found." }, { status: 404 });
  }

  const { data: record, error: insertError } = await admin
    .from("attendance_records")
    .insert({
      event_day_id: eventDayId,
      student_id: studentProfileId,
      type,
      method: "manual",
      manual_reason: reason,
      scanned_by: profile.id,
    })
    .select("id, recorded_at")
    .single();

  if (insertError || !record) {
    const duplicate = insertError?.code === "23505";
    return NextResponse.json(
      {
        error: duplicate
          ? `${student.full_name} already has a ${type === "sign_in" ? "sign-in" : "sign-out"} for this day.`
          : "Could not record attendance.",
      },
      { status: duplicate ? 409 : 500 }
    );
  }

  // Audit write happens after the response so the officer isn't kept waiting.
  after(() =>
    logAudit({
      actorId: profile.id,
      action: "attendance_manual_entry",
      entityType: "attendance_records",
      entityId: record.id,
      details: { studentId: studentProfileId, studentName: student.full_name, eventDayId, type, reason },
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
