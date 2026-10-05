import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { csvResponse } from "@/lib/csv";
import { formatDayDate } from "@/lib/datetime";
import { dayStats, loadDayAttendance, loadEligibleStudents, sectionLabel } from "@/lib/reports";
import type { EventTargets } from "@/lib/eligibility";

// Expected students with no sign-in for one event day, as a CSV — for
// follow-up by section representatives.
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/events/[id]/days/[dayId]/missing">
) {
  const { error } = await requireRole("officer", "admin");
  if (error) return error;

  const { id, dayId } = await params;
  const admin = createAdminClient();

  const { data: event } = await admin
    .from("events")
    .select("title, target_programs, target_year_levels, event_days(id, day_date)")
    .eq("id", id)
    .single<EventTargets & { title: string; event_days: { id: string; day_date: string }[] }>();
  const day = event?.event_days.find((d) => d.id === dayId);
  if (!event || !day) return NextResponse.json({ error: "Event day not found." }, { status: 404 });

  const [byDay, eligible] = await Promise.all([loadDayAttendance(admin, [dayId]), loadEligibleStudents(admin, event)]);
  const { missing } = dayStats(byDay.get(dayId) ?? [], eligible);

  const sorted = [...missing].sort(
    (a, b) => sectionLabel(a).localeCompare(sectionLabel(b), undefined, { numeric: true }) || a.full_name.localeCompare(b.full_name)
  );

  return csvResponse(`${event.title} - ${formatDayDate(day.day_date, "numeric")} - missing.csv`, [
    ["Student ID", "Name", "Program", "Year", "Section"],
    ...sorted.map((s) => [s.student_id, s.full_name, s.program, s.year_level, s.section]),
  ]);
}
