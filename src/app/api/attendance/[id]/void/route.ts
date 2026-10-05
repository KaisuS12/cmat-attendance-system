import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { parseJsonBody } from "@/lib/validation";

const bodySchema = z.object({
  reason: z.string().trim().min(3, "Give a short reason (e.g. “wrong student scanned”)."),
});

// Voids a wrong attendance record (admin only). The row is kept, marked
// voided with who/why, and ignored everywhere attendance is counted; the
// correct record can then be scanned or entered again.
export async function POST(request: Request, { params }: RouteContext<"/api/attendance/[id]/void">) {
  const { profile, error } = await requireRole("admin");
  if (error) return error;

  const { id } = await params;
  const body = await parseJsonBody(request, bodySchema);
  if (body.error) return body.error;

  const admin = createAdminClient();
  const { data: record, error: updateError } = await admin
    .from("attendance_records")
    .update({ voided_at: new Date().toISOString(), voided_by: profile.id, void_reason: body.data.reason })
    .eq("id", id)
    .is("voided_at", null)
    .select("id, event_day_id, student_id, type, profiles!attendance_records_student_id_fkey(full_name)")
    .maybeSingle();

  if (updateError) {
    return NextResponse.json({ error: "Could not void the record." }, { status: 500 });
  }
  if (!record) {
    return NextResponse.json({ error: "Record not found or already voided." }, { status: 404 });
  }

  const student = record.profiles as unknown as { full_name: string } | null;
  await logAudit({
    actorId: profile.id,
    action: "attendance_voided",
    entityType: "attendance_records",
    entityId: id,
    details: {
      studentName: student?.full_name,
      eventDayId: record.event_day_id,
      type: record.type,
      reason: body.data.reason,
    },
  });

  return NextResponse.json({ ok: true });
}
