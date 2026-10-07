import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  generatedIdPrefix,
  IMPORT_MAX_ROWS_PER_REQUEST,
  isValidStudentId,
  normalizeStudentId,
  studentIdToEmail,
} from "@/lib/constants";
import { generateTempPassword } from "@/lib/passwords";
import { logAudit } from "@/lib/audit";
import { rememberTempPassword } from "@/lib/temp-passwords";
import { parseJsonBody } from "@/lib/validation";
import { fetchAll } from "@/lib/supabase/fetch-all";

// Bulk-creates student accounts from the CMAT masterlist (§9). Only usable
// once written permission to use the masterlist has been secured — this
// route just provides the technical capability, it does not itself grant
// authorization to run it.
const CONCURRENCY = 5;

const rowSchema = z.object({
  // Blank = the masterlist has no IDs; one is generated (NAM26-0001, …).
  studentId: z
    .string()
    .default("")
    .transform(normalizeStudentId)
    .refine((id) => id === "" || isValidStudentId(id), "Student ID format is not recognized."),
  fullName: z.string().trim().min(1, "Name is required."),
  program: z.string().trim().optional(),
  yearLevel: z.string().trim().optional(),
});

const bodySchema = z.object({
  students: z.array(rowSchema).min(1).max(IMPORT_MAX_ROWS_PER_REQUEST),
  // Re-importing an updated masterlist: refresh name/program/year of
  // students who already have accounts (their passwords are untouched).
  updateExisting: z.boolean().default(false),
});

type Row = z.infer<typeof rowSchema>;
const GENERATED_ID_DIGITS = 4;
const MAX_ID_ATTEMPTS = 5;
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

  // Skip students that already have an account, so re-running an import (or
  // importing an updated masterlist) is safe. Rows with an ID match by ID;
  // rows without one match by name + program + year level.
  const { updateExisting } = body.data;
  const ids = body.data.students.map((s) => s.studentId).filter(Boolean);
  const unnamed = body.data.students.filter((s) => !s.studentId);
  const existingByStudentId = new Map<string, { id: string; studentId: string }>();
  if (ids.length) {
    const { data } = await admin.from("profiles").select("id, student_id").in("student_id", ids);
    for (const e of data ?? []) existingByStudentId.set(e.student_id as string, { id: e.id, studentId: e.student_id });
  }
  const nameKey = (name: string, program?: string | null, year?: string | null) =>
    `${name.trim().toLowerCase()}|${(program ?? "").trim().toUpperCase()}|${(year ?? "").trim()}`;
  const existingByName = new Map<string, { id: string; studentId: string }>();
  if (unnamed.length) {
    const { data } = await admin
      .from("profiles")
      .select("id, student_id, full_name, program, year_level")
      .eq("role", "student")
      .in("full_name", unnamed.map((s) => s.fullName));
    for (const e of data ?? []) {
      existingByName.set(nameKey(e.full_name, e.program, e.year_level), { id: e.id, studentId: e.student_id ?? "" });
    }
  }

  // Next free generated number for this year, e.g. NAM26-0042 → 43.
  const prefix = generatedIdPrefix();
  let nextSeq = 1;
  if (unnamed.length) {
    const taken = await fetchAll<{ student_id: string | null }>((from, to) =>
      admin.from("profiles").select("student_id").like("student_id", `${prefix}%`).order("student_id").range(from, to)
    );
    for (const t of taken) {
      const n = Number((t.student_id ?? "").slice(prefix.length));
      if (Number.isInteger(n) && n >= nextSeq) nextSeq = n + 1;
    }
  }
  const takeId = () => `${prefix}${String(nextSeq++).padStart(GENERATED_ID_DIGITS, "0")}`;

  async function importOne(student: Row): Promise<Result> {
    const match = student.studentId
      ? existingByStudentId.get(student.studentId)
      : existingByName.get(nameKey(student.fullName, student.program, student.yearLevel));
    const base = { studentId: match?.studentId || student.studentId, fullName: student.fullName };
    const existingId = match?.id;
    if (existingId) {
      if (!updateExisting) return { ...base, status: "exists" };
      const { error: updateError } = await admin
        .from("profiles")
        .update({
          full_name: student.fullName,
          program: student.program || null,
          year_level: student.yearLevel || null,
        })
        .eq("id", existingId);
      return updateError
        ? { ...base, status: "failed", error: updateError.message }
        : { ...base, status: "updated" };
    }

    const tempPassword = generateTempPassword();
    const generated = !student.studentId;
    let created: { user: { id: string } | null } = { user: null };
    for (let attempt = 0; attempt < (generated ? MAX_ID_ATTEMPTS : 1); attempt++) {
      if (generated) base.studentId = takeId();
      const { data, error: createError } = await admin.auth.admin.createUser({
        email: studentIdToEmail(base.studentId),
        password: tempPassword,
        email_confirm: true,
      });
      if (!createError && data.user) {
        created = data;
        break;
      }
      const exists = createError?.code === "email_exists";
      // A generated number already in use (another import running at the
      // same time): move on to the next one.
      if (exists && generated) continue;
      return exists
        ? { ...base, status: "exists" }
        : { ...base, status: "failed", error: createError?.message ?? "Could not create account." };
    }
    if (!created.user) return { ...base, status: "failed", error: "Could not assign a student ID — import again." };

    const { error: profileError } = await admin.from("profiles").insert({
      id: created.user.id,
      role: "student",
      full_name: student.fullName,
      student_id: base.studentId,
      program: student.program || null,
      year_level: student.yearLevel || null,
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
