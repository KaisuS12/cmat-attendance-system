import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  IMPORT_MAX_ROWS_PER_REQUEST,
  isValidStudentId,
  normalizeStudentId,
  studentIdToEmail,
} from "@/lib/constants";
import { generateTempPassword } from "@/lib/passwords";
import { logAudit } from "@/lib/audit";
import { rememberTempPassword } from "@/lib/temp-passwords";
import { parseJsonBody } from "@/lib/validation";

// Bulk-creates student accounts from the CMAT masterlist (§9). Only usable
// once written permission to use the masterlist has been secured — this
// route just provides the technical capability, it does not itself grant
// authorization to run it.
const CONCURRENCY = 5;

const rowSchema = z.object({
  studentId: z
    .string()
    .transform(normalizeStudentId)
    .refine(isValidStudentId, "Student ID format is not recognized."),
  fullName: z.string().trim().min(1, "Name is required."),
  program: z.string().trim().optional(),
  yearLevel: z.string().trim().optional(),
  section: z.string().trim().optional(),
});

const bodySchema = z.object({
  students: z.array(rowSchema).min(1).max(IMPORT_MAX_ROWS_PER_REQUEST),
  // Re-importing an updated masterlist: refresh name/program/year/section of
  // students who already have accounts (their passwords are untouched).
  updateExisting: z.boolean().default(false),
});

type Row = z.infer<typeof rowSchema>;
type Result = {
  studentId: string;
  fullName: string;
  status: "created" | "updated" | "exists" | "failed";
  tempPassword?: string;
  error?: string;
};

export async function POST(request: Request) {
  const { profile, error } = await requireRole("admin");
  if (error) return error;

  const body = await parseJsonBody(request, bodySchema);
  if (body.error) return body.error;

  const admin = createAdminClient();
  const actorId = profile.id;

  // Skip IDs that already have an account, so re-running an import (or
  // importing an updated masterlist) is safe.
  const ids = body.data.students.map((s) => s.studentId);
  const { data: existing } = await admin.from("profiles").select("id, student_id").in("student_id", ids);
  const existingByStudentId = new Map((existing ?? []).map((e) => [e.student_id as string, e.id as string]));
  const { updateExisting } = body.data;

  async function importOne(student: Row): Promise<Result> {
    const base = { studentId: student.studentId, fullName: student.fullName };
    const existingId = existingByStudentId.get(student.studentId);
    if (existingId) {
      if (!updateExisting) return { ...base, status: "exists" };
      const { error: updateError } = await admin
        .from("profiles")
        .update({
          full_name: student.fullName,
          program: student.program || null,
          year_level: student.yearLevel || null,
          section: student.section || null,
        })
        .eq("id", existingId);
      return updateError
        ? { ...base, status: "failed", error: updateError.message }
        : { ...base, status: "updated" };
    }

    const tempPassword = generateTempPassword();
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: studentIdToEmail(student.studentId),
      password: tempPassword,
      email_confirm: true,
    });

    if (createError || !created.user) {
      const exists = createError?.code === "email_exists";
      return exists
        ? { ...base, status: "exists" }
        : { ...base, status: "failed", error: createError?.message ?? "Could not create account." };
    }

    const { error: profileError } = await admin.from("profiles").insert({
      id: created.user.id,
      role: "student",
      full_name: student.fullName,
      student_id: student.studentId,
      program: student.program || null,
      year_level: student.yearLevel || null,
      section: student.section || null,
      must_change_password: true,
    });

    if (profileError) {
      await admin.auth.admin.deleteUser(created.user.id);
      return { ...base, status: "failed", error: profileError.message };
    }

    await rememberTempPassword(admin, created.user.id, tempPassword, actorId);
    return { ...base, status: "created", tempPassword };
  }

  // Bounded concurrency: fast enough to stay under the time limit, gentle
  // enough not to trip Supabase Auth's admin rate limits.
  const students = body.data.students;
  const results: Result[] = new Array(students.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, students.length) }, async () => {
      while (next < students.length) {
        const i = next++;
        results[i] = await importOne(students[i]);
      }
    })
  );

  await logAudit({
    actorId: profile.id,
    action: "students_bulk_imported",
    entityType: "profiles",
    details: {
      total: students.length,
      created: results.filter((r) => r.status === "created").length,
      updated: results.filter((r) => r.status === "updated").length,
      existing: results.filter((r) => r.status === "exists").length,
      failed: results.filter((r) => r.status === "failed").length,
    },
  });

  return NextResponse.json({ results });
}
