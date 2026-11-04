import type { SupabaseClient } from "@supabase/supabase-js";

// ID photos for manual entries (migration 0012).
export const PROOF_BUCKET = "manual-id-photos";
export const PROOF_MAX_BYTES = 1024 * 1024;
export const PROOF_RETENTION_DAYS = 90;
const PURGE_BATCH = 500;

/** JPEG files start with FF D8 FF, whatever the browser claims about them. */
export function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

/** A message for the officer if this can't be used as the ID photo, else null. */
export function proofPhotoProblem(bytes: Uint8Array): string | null {
  if (bytes.length === 0) return "Take a photo of the student's ID first.";
  if (bytes.length > PROOF_MAX_BYTES) return "The photo is too large. Retake it and try again.";
  if (!isJpeg(bytes)) return "That photo couldn't be read. Retake it and try again.";
  return null;
}

/** Photos recorded before this moment are due for deletion. */
export function proofPurgeCutoff(now: number): Date {
  return new Date(now - PROOF_RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

// Removes the files first: if that fails, the records still point at them and
// the next daily run tries again. The attendance record and reason stay.
export async function purgeOldProofPhotos(admin: SupabaseClient, now: number = Date.now()): Promise<number> {
  const { data, error } = await admin
    .from("attendance_records")
    .select("id, proof_photo_path")
    .not("proof_photo_path", "is", null)
    .lt("recorded_at", proofPurgeCutoff(now).toISOString())
    .limit(PURGE_BATCH);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { id: string; proof_photo_path: string }[];
  if (rows.length === 0) return 0;

  const { error: removeError } = await admin.storage.from(PROOF_BUCKET).remove(rows.map((r) => r.proof_photo_path));
  if (removeError) throw new Error(removeError.message);

  const { error: updateError } = await admin
    .from("attendance_records")
    .update({ proof_photo_path: null, proof_photo_deleted_at: new Date(now).toISOString() })
    .in("id", rows.map((r) => r.id));
  if (updateError) throw new Error(updateError.message);
  return rows.length;
}
