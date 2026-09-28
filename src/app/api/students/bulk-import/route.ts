import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { studentIdToEmail } from "@/lib/constants";
import { logAudit } from "@/lib/audit";

// Bulk-creates student accounts from the CMAT masterlist (§9). Only usable
// once written permission to use the masterlist has been secured — this
// route just provides the technical capability, it does not itself grant
// authorization to run it.
const rowSchema = z.object({
  studentId: z.string().min(1),
  fullName: z.string().min(1),
  program: z.string().optional(),
  yearLevel: z.string().optional(),
  section: z.string().optional(),
});

const bodySchema = z.object({ students: z.array(rowSchema).min(1).max(2000) });

function generateTempPassword() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const admin = createAdminClient();
  const results: { studentId: string; status: "created" | "failed"; tempPassword?: string; error?: string }[] = [];

  for (const student of parsed.data.students) {
    const email = studentIdToEmail(student.studentId);
    const tempPassword = generateTempPassword();

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
    });

    if (createError || !created.user) {
      results.push({ studentId: student.studentId, status: "failed", error: createError?.message });
      continue;
    }

    const { error: profileError } = await admin.from("profiles").insert({
      id: created.user.id,
      role: "student",
      full_name: student.fullName,
      student_id: student.studentId,
      program: student.program ?? null,
      year_level: student.yearLevel ?? null,
      section: student.section ?? null,
    });

    if (profileError) {
      await admin.auth.admin.deleteUser(created.user.id);
      results.push({ studentId: student.studentId, status: "failed", error: profileError.message });
      continue;
    }

    results.push({ studentId: student.studentId, status: "created", tempPassword });
  }

  await logAudit({
    actorId: profile.id,
    action: "students_bulk_imported",
    entityType: "profiles",
    details: {
      total: parsed.data.students.length,
      created: results.filter((r) => r.status === "created").length,
      failed: results.filter((r) => r.status === "failed").length,
    },
  });

  return NextResponse.json({ results });
}
