// Supabase Auth is email/password only. Students log in with just their
// student ID (§7), so each student account is created with a synthetic,
// non-deliverable email built from this domain — never actually emailed
// anywhere, just used as Auth's account key under the hood.
export const STUDENT_EMAIL_DOMAIN = "students.cmat-council.internal";

export function studentIdToEmail(studentId: string): string {
  return `${studentId.trim().toLowerCase()}@${STUDENT_EMAIL_DOMAIN}`;
}
