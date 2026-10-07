import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { isValidStudentId, normalizeStudentId, studentIdToEmail } from "@/lib/constants";
import { parseJsonBody } from "@/lib/validation";

const optionalText = z
  .string()
  .trim()
  .transform((v) => v || null)
  .nullable()
  .optional();

const bodySchema = z.object({
  fullName: z.string().trim().min(1, "Name is required.").optional(),
  studentId: z
    .string()
    .transform(normalizeStudentId)
    .refine(isValidStudentId, "Student ID format is not recognized.")
    .optional(),
  program: optionalText,
  yearLevel: optionalText,
});

// Fix a student's details (typo in the name, wrong year, wrong ID). A new
// student ID also changes the login, since it's the account's username.
export async function PATCH(request: Request, { params }: RouteContext<"/api/students/[id]">) {
  const { profile, error } = await requireRole("admin");
  if (error) return error;

  const { id } = await params;
  const body = await parseJsonBody(request, bodySchema);
  if (body.error) return body.error;
  const b = body.data;

  const admin = createAdminClient();
  const { data: before } = await admin
    .from("profiles")
    .select("full_name, student_id, program, year_level, role")
    .eq("id", id)
    .single();
  if (!before || before.role !== "student") {
    return NextResponse.json({ error: "Student not found." }, { status: 404 });
  }

  const changes: Record<string, string | null> = {};
  if (b.fullName !== undefined) changes.full_name = b.fullName;
  if (b.program !== undefined) changes.program = b.program;
  if (b.yearLevel !== undefined) changes.year_level = b.yearLevel;

  const idChanged = b.studentId !== undefined && b.studentId !== before.student_id;
  if (idChanged) {
    const { data: taken } = await admin
      .from("profiles")
      .select("id")
      .eq("student_id", b.studentId!)
      .neq("id", id)
      .maybeSingle();
    if (taken) {
      return NextResponse.json({ error: "Another student already has that ID." }, { status: 409 });
    }
    // Change the login first: if it fails, nothing has changed yet.
    const { error: authError } = await admin.auth.admin.updateUserById(id, {
      email: studentIdToEmail(b.studentId!),
      email_confirm: true,
    });
    if (authError) {
      return NextResponse.json({ error: "Could not change the student's login ID." }, { status: 500 });
    }
    changes.student_id = b.studentId!;
  }

  if (Object.keys(changes).length === 0) return NextResponse.json({ ok: true });

  const { error: updateError } = await admin.from("profiles").update(changes).eq("id", id);
  if (updateError) {
    if (idChanged && before.student_id) {
      // Keep login and profile consistent if the profile update failed.
      await admin.auth.admin.updateUserById(id, { email: studentIdToEmail(before.student_id), email_confirm: true });
    }
    return NextResponse.json({ error: "Could not update the student." }, { status: 500 });
  }

  await logAudit({
    actorId: profile.id,
    action: "student_updated",
    entityType: "profiles",
    entityId: id,
    details: {
      before: {
        full_name: before.full_name,
        student_id: before.student_id,
        program: before.program,
        year_level: before.year_level,
      },
      after: changes,
    },
  });

  return NextResponse.json({ ok: true });
}
