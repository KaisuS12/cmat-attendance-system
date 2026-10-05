import { createClient } from "@/lib/supabase/server";
import { formatDayDate, formatTime, requestTime } from "@/lib/datetime";
import { Badge, EmptyState } from "@/components/ui";
import { SemesterSelect } from "@/components/SemesterSelect";
import { PrintButton } from "@/components/PrintButton";
import type { AttendanceRecord, EventDay, Profile, Semester } from "@/types/database";

type EventWithDays = { id: string; title: string; event_days: EventDay[] };

// A student's full attendance for one semester, including days they missed —
// the printable record presented at clearance signing (§4.4). Used by the
// student's own history page and by admins viewing any student.
export async function AttendanceRecordView({
  student,
  semesterParam,
  basePath,
}: {
  student: Profile;
  semesterParam: string | undefined;
  basePath: string;
}) {
  const supabase = await createClient();

  const { data: semesterRows } = await supabase
    .from("semesters")
    .select("*")
    .order("start_date", { ascending: false });
  const semesters = (semesterRows ?? []) as Semester[];
  const semester =
    semesters.find((s) => s.id === semesterParam) ?? semesters.find((s) => s.is_active) ?? semesters[0] ?? null;

  let eventsQuery = supabase.from("events").select("id, title, event_days(*)");
  if (semester?.is_active) {
    // Events created before any semester existed have none; count them toward the current one.
    eventsQuery = eventsQuery.or(`semester_id.eq.${semester.id},semester_id.is.null`);
  } else if (semester) {
    eventsQuery = eventsQuery.eq("semester_id", semester.id);
  }
  const { data: eventRows } = await eventsQuery;
  const events = ((eventRows ?? []) as EventWithDays[])
    .map((e) => ({ ...e, event_days: [...e.event_days].sort((a, b) => a.day_date.localeCompare(b.day_date)) }))
    .filter((e) => e.event_days.length > 0)
    .sort((a, b) => a.event_days[0].day_date.localeCompare(b.event_days[0].day_date));

  const dayIds = events.flatMap((e) => e.event_days.map((d) => d.id));
  const { data: recordRows } = await supabase
    .from("attendance_records")
    .select("*")
    .eq("student_id", student.id)
    .in("event_day_id", dayIds.length > 0 ? dayIds : ["00000000-0000-0000-0000-000000000000"]);
  const records = (recordRows ?? []) as AttendanceRecord[];
  const recordFor = (dayId: string, type: "sign_in" | "sign_out") =>
    records.find((r) => r.event_day_id === dayId && r.type === type);

  const now = requestTime();
  let present = 0;
  let counted = 0;
  for (const e of events) {
    for (const d of e.event_days) {
      if (new Date(d.sign_out_end).getTime() > now) continue; // not over yet
      counted++;
      if (recordFor(d.id, "sign_in") && recordFor(d.id, "sign_out")) present++;
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        {semesters.length > 0 && semester ? (
          <SemesterSelect semesters={semesters} value={semester.id} basePath={basePath} />
        ) : (
          <span />
        )}
        <PrintButton />
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 print:border-0 print:p-0">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              CMAT Council · Attendance record
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">{student.full_name}</h2>
            <p className="text-sm text-slate-600">
              {student.student_id}
              {[student.program, student.year_level, student.section].filter(Boolean).length > 0 && (
                <> · {[student.program, student.year_level, student.section].filter(Boolean).join(" · ")}</>
              )}
            </p>
            <p className="mt-1 text-sm text-slate-500">{semester?.name ?? "All events"}</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-semibold text-slate-900 tabular-nums">
              {present}
              <span className="text-lg text-slate-400">/{counted}</span>
            </p>
            <p className="text-xs uppercase tracking-wide text-slate-400">Days present</p>
          </div>
        </div>

        {events.length === 0 ? (
          <div className="mt-4">
            <EmptyState>No events in this semester yet.</EmptyState>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="mt-2 w-full min-w-[32rem] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="py-2 pr-3">Event</th>
                  <th className="py-2 pr-3">Day</th>
                  <th className="py-2 pr-3">Sign in</th>
                  <th className="py-2 pr-3">Sign out</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {events.flatMap((e) =>
                  e.event_days.map((d, i) => {
                    const signIn = recordFor(d.id, "sign_in");
                    const signOut = recordFor(d.id, "sign_out");
                    const over = new Date(d.sign_out_end).getTime() <= now;
                    return (
                      <tr key={d.id} className="break-inside-avoid">
                        <td className="py-2.5 pr-3 font-medium text-slate-800">{i === 0 ? e.title : ""}</td>
                        <td className="py-2.5 pr-3 text-slate-600">{formatDayDate(d.day_date, "numeric")}</td>
                        <td className="py-2.5 pr-3 text-slate-600">
                          {signIn ? formatTime(signIn.recorded_at) : "—"}
                          {signIn?.method === "manual" && <span className="ml-1 text-xs text-slate-400">(manual)</span>}
                        </td>
                        <td className="py-2.5 pr-3 text-slate-600">
                          {signOut ? formatTime(signOut.recorded_at) : "—"}
                          {signOut?.method === "manual" && <span className="ml-1 text-xs text-slate-400">(manual)</span>}
                        </td>
                        <td className="py-2.5">
                          {signIn && signOut ? (
                            <Badge tone="green">Present</Badge>
                          ) : !over ? (
                            <Badge tone="slate">{signIn ? "In progress" : "Upcoming"}</Badge>
                          ) : signIn ? (
                            <Badge tone="amber">No sign-out</Badge>
                          ) : signOut ? (
                            <Badge tone="amber">No sign-in</Badge>
                          ) : (
                            <Badge tone="red">Absent</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-6 hidden text-xs text-slate-400 print:block">
          Generated {new Date().toLocaleDateString("en-US", { timeZone: "Asia/Manila", dateStyle: "long" })} ·
          CMAT Council QR Attendance System
        </p>
      </div>
    </div>
  );
}
