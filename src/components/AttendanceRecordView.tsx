import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { formatDayDate, formatTime, requestTime } from "@/lib/datetime";
import { Badge, EmptyState } from "@/components/ui";
import { SemesterSelect } from "@/components/SemesterSelect";
import { PrintButton } from "@/components/PrintButton";
import { isEventForStudent, type EventTargets } from "@/lib/eligibility";
import type { AttendanceRecord, EventDay, Profile, Semester } from "@/types/database";
import { APP_FULL_NAME } from "@/lib/brand";

type EventWithDays = EventTargets & { id: string; title: string; event_days: EventDay[] };

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

  let eventsQuery = supabase
    .from("events")
    .select("id, title, target_programs, target_year_levels, event_days(*)");
  if (semester?.is_active) {
    // Events created before any semester existed have none; count them toward the current one.
    eventsQuery = eventsQuery.or(`semester_id.eq.${semester.id},semester_id.is.null`);
  } else if (semester) {
    eventsQuery = eventsQuery.eq("semester_id", semester.id);
  }
  const { data: eventRows } = await eventsQuery;
  const allEvents = ((eventRows ?? []) as EventWithDays[])
    .map((e) => ({ ...e, event_days: [...e.event_days].sort((a, b) => a.day_date.localeCompare(b.day_date)) }))
    .filter((e) => e.event_days.length > 0)
    .sort((a, b) => a.event_days[0].day_date.localeCompare(b.event_days[0].day_date));

  const dayIds = allEvents.flatMap((e) => e.event_days.map((d) => d.id));
  const { data: recordRows } = await supabase
    .from("attendance_records")
    .select("*")
    .eq("student_id", student.id)
    .is("voided_at", null)
    .in("event_day_id", dayIds.length > 0 ? dayIds : ["00000000-0000-0000-0000-000000000000"]);
  const records = (recordRows ?? []) as AttendanceRecord[];
  const recordFor = (dayId: string, type: "sign_in" | "sign_out") =>
    records.find((r) => r.event_day_id === dayId && r.type === type);

  // Events meant for other programs/years don't count against the student;
  // they're listed only if the student attended anyway, as "Not required".
  const isRequired = (e: EventWithDays) => isEventForStudent(e, student);
  const attendedAny = (e: EventWithDays) => e.event_days.some((d) => records.some((r) => r.event_day_id === d.id));
  const shown = allEvents.filter((e) => isRequired(e) || attendedAny(e));

  const now = requestTime();
  let present = 0;
  let counted = 0;
  for (const e of shown.filter(isRequired)) {
    for (const d of e.event_days) {
      const complete = Boolean(recordFor(d.id, "sign_in") && recordFor(d.id, "sign_out"));
      // A day counts once it's over — or as soon as the student has fully
      // signed in and out, even while the sign-out window is still open.
      // Days still in progress without a complete record aren't counted yet.
      if (!complete && new Date(d.sign_out_end).getTime() > now) continue;
      counted++;
      if (complete) present++;
    }
  }

  const rows: RecordRow[] = shown.flatMap((event) =>
    event.event_days.map((day, i) => ({
      event,
      day,
      firstOfEvent: i === 0,
      required: isRequired(event),
      over: new Date(day.sign_out_end).getTime() <= now,
      signIn: recordFor(day.id, "sign_in"),
      signOut: recordFor(day.id, "sign_out"),
    }))
  );

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
          <div className="flex items-start gap-3">
          <Image src="/brand/cmat-logo.png" alt="" width={64} height={65} className="h-16 w-16 shrink-0 object-contain" />
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              {APP_FULL_NAME} · Attendance record
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
          </div>
          <div className="text-right">
            <p className="text-3xl font-semibold text-slate-900 tabular-nums">
              {present}
              <span className="text-lg text-slate-400">/{counted}</span>
            </p>
            <p className="text-xs uppercase tracking-wide text-slate-400">Days present</p>
          </div>
        </div>

        {shown.length === 0 ? (
          <div className="mt-4">
            <EmptyState>No events for you in this semester yet.</EmptyState>
          </div>
        ) : (
          <>
            {/* Phones: one card per day */}
            <ul className="mt-3 divide-y divide-slate-100 sm:hidden print:hidden">
              {rows.map((r) => (
                <li key={r.day.id} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800">{r.event.title}</p>
                      <p className="text-sm text-slate-500">{formatDayDate(r.day.day_date, "numeric")}</p>
                    </div>
                    <StatusBadge row={r} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    In {r.signIn ? formatTime(r.signIn.recorded_at) : "—"}
                    {r.signIn?.method === "manual" && " (manual)"} · Out{" "}
                    {r.signOut ? formatTime(r.signOut.recorded_at) : "—"}
                    {r.signOut?.method === "manual" && " (manual)"}
                  </p>
                </li>
              ))}
            </ul>

            {/* Wider screens and print: table */}
            <div className="hidden overflow-x-auto sm:block print:block">
              <table className="mt-2 w-full text-sm">
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
                  {rows.map((r) => (
                    <tr key={r.day.id} className="break-inside-avoid">
                      <td className="py-2.5 pr-3 font-medium text-slate-800">{r.firstOfEvent ? r.event.title : ""}</td>
                      <td className="py-2.5 pr-3 text-slate-600">{formatDayDate(r.day.day_date, "numeric")}</td>
                      <td className="py-2.5 pr-3 text-slate-600">
                        {r.signIn ? formatTime(r.signIn.recorded_at) : "—"}
                        {r.signIn?.method === "manual" && <span className="ml-1 text-xs text-slate-400">(manual)</span>}
                      </td>
                      <td className="py-2.5 pr-3 text-slate-600">
                        {r.signOut ? formatTime(r.signOut.recorded_at) : "—"}
                        {r.signOut?.method === "manual" && <span className="ml-1 text-xs text-slate-400">(manual)</span>}
                      </td>
                      <td className="py-2.5">
                        <StatusBadge row={r} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <p className="mt-6 hidden text-xs text-slate-400 print:block">
          Generated {new Date().toLocaleDateString("en-US", { timeZone: "Asia/Manila", dateStyle: "long" })} ·
          {APP_FULL_NAME}
        </p>
      </div>
    </div>
  );
}

interface RecordRow {
  event: EventWithDays;
  day: EventDay;
  firstOfEvent: boolean;
  required: boolean;
  over: boolean;
  signIn: AttendanceRecord | undefined;
  signOut: AttendanceRecord | undefined;
}

function StatusBadge({ row }: { row: RecordRow }) {
  const { signIn, signOut, over, required } = row;
  if (!required) return <Badge tone="slate">Not required</Badge>;
  if (signIn && signOut) return <Badge tone="green">Present</Badge>;
  if (!over) return <Badge tone="slate">{signIn ? "In progress" : "Upcoming"}</Badge>;
  if (signIn) return <Badge tone="amber">No sign-out</Badge>;
  if (signOut) return <Badge tone="amber">No sign-in</Badge>;
  return <Badge tone="red">Absent</Badge>;
}
