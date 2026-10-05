import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { csvResponse } from "@/lib/csv";
import { formatDayDate, formatDateTime } from "@/lib/datetime";
import { loadDayAttendance } from "@/lib/reports";
import type { EventDay } from "@/types/database";

// One row per student per event day, sign-in and sign-out side by side.
export async function GET(_request: Request, { params }: RouteContext<"/api/events/[id]/export">) {
  const { error } = await requireRole("officer", "admin");
  if (error) return error;

  const { id } = await params;
  const admin = createAdminClient();

  const { data: event } = await admin
    .from("events")
    .select("title, event_days(*)")
    .eq("id", id)
    .single<{ title: string; event_days: EventDay[] }>();
  if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });

  const days = [...event.event_days].sort((a, b) => a.day_date.localeCompare(b.day_date));
  const byDay = await loadDayAttendance(admin, days.map((d) => d.id));

  const rows: (string | null)[][] = [
    [
      "Day",
      "Student ID",
      "Name",
      "Program",
      "Year",
      "Section",
      "Sign in",
      "Sign out",
      "Status",
      "Manual entry reason",
    ],
  ];

  for (const day of days) {
    for (const r of byDay.get(day.id) ?? []) {
      const reasons = [r.signIn, r.signOut]
        .filter((e) => e?.method === "manual")
        .map((e) => e!.reason)
        .join("; ");
      rows.push([
        formatDayDate(day.day_date, "numeric"),
        r.student.student_id,
        r.student.full_name,
        r.student.program,
        r.student.year_level,
        r.student.section,
        r.signIn ? formatDateTime(r.signIn.at) : "",
        r.signOut ? formatDateTime(r.signOut.at) : "",
        r.signIn && r.signOut ? "Complete" : r.signIn ? "No sign-out" : "No sign-in",
        reasons,
      ]);
    }
  }

  return csvResponse(`${event.title} - attendance.csv`, rows);
}
