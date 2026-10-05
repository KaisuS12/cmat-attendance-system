// Supabase Auth is email/password only. Students log in with just their
// student ID (§7), so each student account is created with a synthetic,
// non-deliverable email built from this domain — never actually emailed
// anywhere, just used as Auth's account key under the hood.
export const STUDENT_EMAIL_DOMAIN = "students.cmat-council.internal";

export function studentIdToEmail(studentId: string): string {
  return `${normalizeStudentId(studentId).toLowerCase()}@${STUDENT_EMAIL_DOMAIN}`;
}

export function normalizeStudentId(studentId: string): string {
  return studentId.trim();
}

// Format enforced on masterlist import (design doc §10.1 is still open, so
// it's configurable). Defaults to the "21-00123" style shown on the login page.
export const STUDENT_ID_PATTERN = new RegExp(
  process.env.NEXT_PUBLIC_STUDENT_ID_PATTERN ?? "^\\d{2}-\\d{4,6}$"
);

export function isValidStudentId(studentId: string): boolean {
  return STUDENT_ID_PATTERN.test(normalizeStudentId(studentId));
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
