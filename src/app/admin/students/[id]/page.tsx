import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AttendanceRecordView } from "@/components/AttendanceRecordView";
import { AccountActions } from "@/components/AccountActions";
import { EditStudentForm } from "@/components/EditStudentForm";
import { Badge } from "@/components/ui";
import type { Profile } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function StudentDetailPage({ params, searchParams }: PageProps<"/admin/students/[id]">) {
  const { id } = await params;
  const { semester } = await searchParams;
  const supabase = await createClient();

  const { data: student } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .eq("role", "student")
    .single<Profile>();

  if (!student) notFound();

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/admin/students" className="text-sm text-slate-500 hover:text-slate-900">
          ← Students
        </Link>
        <div className="flex items-center gap-2">
          {!student.is_active && <Badge tone="red">Deactivated</Badge>}
          {student.must_change_password && <Badge tone="amber">Temporary password</Badge>}
          <AccountActions
            userId={student.id}
            name={student.full_name}
            isActive={student.is_active}
            slip={{
              studentId: student.student_id ?? "",
              program: student.program,
              yearLevel: student.year_level,
              section: student.section,
            }}
          />
        </div>
      </div>

      <div className="mt-3 print:hidden">
        <EditStudentForm key={`${student.student_id}-${student.full_name}`} student={student} />
      </div>

      <div className="mt-4">
        <AttendanceRecordView
          student={student}
          semesterParam={typeof semester === "string" ? semester : undefined}
          basePath={`/admin/students/${student.id}`}
        />
      </div>
    </div>
  );
}
