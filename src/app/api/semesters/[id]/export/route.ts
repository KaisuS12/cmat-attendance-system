import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { csvResponse } from "@/lib/csv";
import { formatDayDate } from "@/lib/datetime";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { loadDayAttendance, type StudentSummary } from "@/lib/reports";
import { isEventForStudent, type EventTargets } from "@/lib/eligibility";
import type { EventDay } from "@/types/database";

// Clearance sheet: every student × every event day in the semester, plus
// totals. A day counts as attended only with both a sign-in and a sign-out.
export async function GET(_request: Request, { params }: RouteContext<"/api/semesters/[id]/export">) {
  const { error } = await requireRole("admin");
  if (error) return error;

  const { id } = await params;
  const admin = createAdminClient();

  const { data: semester } = await admin.from("semesters").select("name, is_active").eq("id", id).single();
  if (!semester) return NextResponse.json({ error: "Semester not found." }, { status: 404 });

  // Events created before any semester existed have none; they count toward
  // the current one (matching what students see on their record).
  const { data: events } = await admin
    .from("events")
    .select("title, target_programs, target_year_levels, event_days(*)")
    .or(semester.is_active ? `semester_id.eq.${id},semester_id.is.null` : `semester_id.eq.${id}`)
    .overrideTypes<(EventTargets & { title: string; event_days: EventDay[] })[], { merge: false }>();

  const columns = (events ?? [])
    .flatMap((e) => e.event_days.map((d) => ({ title: e.title, event: e, day: d })))
    .sort((a, b) => a.day.sign_in_start.localeCompare(b.day.sign_in_start));

  const byDay = await loadDayAttendance(admin, columns.map((c) => c.day.id));
  const status = new Map<string, string>(); // `${dayId}:${profileId}` → cell
  for (const [dayId, rows] of byDay) {
    for (const r of rows) {
      status.set(
        `${dayId}:${r.student.id}`,
        r.signIn && r.signOut ? "Present" : r.signIn ? "No sign-out" : "No sign-in"
      );
    }
  }

  const students = await fetchAll<StudentSummary>((from, to) =>
    admin
      .from("profiles")
      .select("id, student_id, full_name, program, year_level, section")
      .eq("role", "student")
      .order("full_name")
      .order("id")
      .range(from, to)
  );

  const rows: (string | number | null)[][] = [
    [
      "Student ID",
      "Name",
      "Program",
      "Year",
      "Section",
      ...columns.map((c) => `${c.title} (${formatDayDate(c.day.day_date, "numeric")})`),
      "Days present",
      "Required days",
    ],
  ];

  // Days of events meant for other programs/years are "N/A" for a student
  // (unless they attended anyway) and don't count toward their total.
  for (const s of students) {
    const cells = columns.map((c) => {
      const recorded = status.get(`${c.day.id}:${s.id}`);
      if (recorded) return recorded;
      return isEventForStudent(c.event, s) ? "Absent" : "N/A";
    });
    const required = columns.filter((c) => isEventForStudent(c.event, s));
    rows.push([
      s.student_id,
      s.full_name,
      s.program,
      s.year_level,
      s.section,
      ...cells,
      required.filter((c) => status.get(`${c.day.id}:${s.id}`) === "Present").length,
      required.length,
    ]);
  }

  return csvResponse(`${semester.name} - clearance.csv`, rows);
}
