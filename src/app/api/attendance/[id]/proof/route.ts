import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { PROOF_BUCKET, PROOF_RETENTION_DAYS } from "@/lib/proof-photos";

const LINK_SECONDS = 60;

// The ID photo of a manual entry, for admins comparing it with the record.
// It's personal data: the link is short-lived and every view is logged.
export async function GET(_request: Request, { params }: RouteContext<"/api/attendance/[id]/proof">) {
  const { profile, error } = await requireRole("admin");
  if (error) return error;

  const { id } = await params;
  const admin = createAdminClient();
  const { data: record } = await admin
    .from("attendance_records")
    .select(
      "id, method, type, recorded_at, manual_reason, proof_photo_path, proof_photo_deleted_at, student:profiles!attendance_records_student_id_fkey(full_name, student_id), officer:profiles!attendance_records_scanned_by_fkey(full_name)"
    )
    .eq("id", id)
    .maybeSingle<{
      id: string;
      method: string;
      type: string;
      recorded_at: string;
      manual_reason: string | null;
      proof_photo_path: string | null;
      proof_photo_deleted_at: string | null;
      student: { full_name: string; student_id: string | null };
      officer: { full_name: string };
    }>();
  if (!record || record.method !== "manual") {
    return NextResponse.json({ error: "Manual entry not found." }, { status: 404 });
  }

  const details = {
    studentName: record.student.full_name,
    studentId: record.student.student_id,
    officerName: record.officer.full_name,
    recordedAt: record.recorded_at,
    type: record.type,
    reason: record.manual_reason,
  };
  const headers = { "Cache-Control": "no-store" };

  if (!record.proof_photo_path) {
    const message = record.proof_photo_deleted_at
      ? `The photo was deleted automatically ${PROOF_RETENTION_DAYS} days after the entry.`
      : "No photo: this entry was made before ID photos were required.";
    return NextResponse.json({ ...details, url: null, message }, { headers });
  }

  const { data: signed, error: signError } = await admin.storage
    .from(PROOF_BUCKET)
    .createSignedUrl(record.proof_photo_path, LINK_SECONDS);
  if (signError || !signed) {
    return NextResponse.json({ error: "Could not open the photo. Try again." }, { status: 500 });
  }

  await logAudit({
    actorId: profile.id,
    action: "manual_proof_viewed",
    entityType: "attendance_records",
    entityId: record.id,
    details: { studentName: record.student.full_name, officerName: record.officer.full_name },
  });
  return NextResponse.json({ ...details, url: signed.signedUrl, message: null }, { headers });
}
