// Supabase Auth is email/password only. Students log in with just their
// student ID (§7), so each student account is created with a synthetic,
// non-deliverable email built from this domain — never actually emailed
// anywhere, just used as Auth's account key under the hood.
export const STUDENT_EMAIL_DOMAIN = "students.cmat-council.internal";

export function studentIdToEmail(studentId: string): string {
  return `${normalizeStudentId(studentId).toLowerCase()}@${STUDENT_EMAIL_DOMAIN}`;
}

// IDs the system generates for students whose masterlist has no school ID
// number: "NAM" + two-digit year + a sequence number, e.g. NAM26-0001. They
// can never clash with a real school ID and are printed on credential slips.
export const GENERATED_ID_PATTERN = /^NAM\d{2}-\d{4,6}$/;

export function generatedIdPrefix(date: Date = new Date()): string {
  return `NAM${String(date.getFullYear()).slice(-2)}-`;
}

export function normalizeStudentId(studentId: string): string {
  const id = studentId.trim();
  // Generated IDs are stored in capitals; typing "nam26-0001" still works.
  return /^nam\d{2}-\d+$/i.test(id) ? id.toUpperCase() : id;
}

// Format enforced on masterlist import (design doc §10.1 is still open, so
// it's configurable). Defaults to the "21-00123" style shown on the login page.
export const STUDENT_ID_PATTERN = new RegExp(
  process.env.NEXT_PUBLIC_STUDENT_ID_PATTERN ?? "^\\d{2}-\\d{4,6}$"
);

export function isValidStudentId(studentId: string): boolean {
  const id = normalizeStudentId(studentId);
  return STUDENT_ID_PATTERN.test(id) || GENERATED_ID_PATTERN.test(id);
}

export const MIN_PASSWORD_LENGTH = 8;

// The admin import page sends the masterlist in chunks of this size, so each
// bulk-import request finishes well inside a serverless function's time limit.
export const IMPORT_CHUNK_SIZE = 50;
export const IMPORT_MAX_ROWS_PER_REQUEST = 100;

// Show the "copy code" / "paste code" helpers that let you test without a
// camera. Never in production: together they let a token generated remotely
// (with faked coordinates) be recorded without the student being present.
export const ENABLE_TOKEN_DEBUG_TOOLS = process.env.NODE_ENV !== "production";
