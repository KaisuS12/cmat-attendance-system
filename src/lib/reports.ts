import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { isEventForStudent, type EventTargets } from "@/lib/eligibility";
import type { AttendanceMethod, AttendanceType } from "@/types/database";

export interface StudentSummary {
  id: string;
  student_id: string | null;
  full_name: string;
  program: string | null;
  year_level: string | null;
  section: string | null;
}

export interface AttendanceEntry {
  id: string;
  at: string;
  method: AttendanceMethod;
  reason: string | null;
}

export interface DayAttendanceRow {
  student: StudentSummary;
  signIn: AttendanceEntry | null;
  signOut: AttendanceEntry | null;
}

interface RecordWithStudent {
  id: string;
  event_day_id: string;
  type: AttendanceType;
  method: AttendanceMethod;
  manual_reason: string | null;
  recorded_at: string;
  profiles: StudentSummary;
}

// All attendance for the given event days, joined with the student, grouped
// into one row per (day, student) with their sign-in and sign-out side by side.
export async function loadDayAttendance(
  client: SupabaseClient,
  dayIds: string[]
): Promise<Map<string, DayAttendanceRow[]>> {
  const byDay = new Map<string, DayAttendanceRow[]>();
  if (dayIds.length === 0) return byDay;

  const records = await fetchAll<RecordWithStudent>((from, to) =>
    client
      .from("attendance_records")
      .select(
        "id, event_day_id, type, method, manual_reason, recorded_at, profiles!attendance_records_student_id_fkey(id, student_id, full_name, program, year_level, section)"
      )
      .in("event_day_id", dayIds)
      .is("voided_at", null)
      .order("recorded_at")
      .order("id")
      .range(from, to)
      .overrideTypes<RecordWithStudent[], { merge: false }>()
  );

  const rowIndex = new Map<string, DayAttendanceRow>();
  for (const r of records) {
    const key = `${r.event_day_id}:${r.profiles.id}`;
    let row = rowIndex.get(key);
    if (!row) {
      row = { student: r.profiles, signIn: null, signOut: null };
      rowIndex.set(key, row);
      if (!byDay.has(r.event_day_id)) byDay.set(r.event_day_id, []);
      byDay.get(r.event_day_id)!.push(row);
    }
    const entry = { id: r.id, at: r.recorded_at, method: r.method, reason: r.manual_reason };
    if (r.type === "sign_in") row.signIn = entry;
    else row.signOut = entry;
  }

  for (const rows of byDay.values()) {
    rows.sort((a, b) => a.student.full_name.localeCompare(b.student.full_name));
  }
  return byDay;
}

export function dayCounts(rows: DayAttendanceRow[]) {
  const signedIn = rows.filter((r) => r.signIn).length;
  const signedOut = rows.filter((r) => r.signOut).length;
  const complete = rows.filter((r) => r.signIn && r.signOut).length;
  return { signedIn, signedOut, complete, incomplete: rows.length - complete };
}

export interface SectionStat {
  label: string;
  expected: number;
  signedIn: number;
}

export function sectionLabel(s: Pick<StudentSummary, "program" | "year_level" | "section">): string {
  const yearSection = [s.year_level, s.section].filter(Boolean).join("-");
  return [s.program, yearSection].filter(Boolean).join(" ") || "No section";
}

// Every active student the event is meant for (all students when untargeted).
export async function loadEligibleStudents(client: SupabaseClient, event: EventTargets): Promise<StudentSummary[]> {
  const students = await fetchAll<StudentSummary & { is_active: boolean | null }>((from, to) =>
    client
      .from("profiles")
      .select("id, student_id, full_name, program, year_level, section, is_active")
      .eq("role", "student")
      .order("full_name")
      .order("id")
      .range(from, to)
  );
  return students.filter((s) => s.is_active !== false && isEventForStudent(event, s));
}

// Expected / missing / per-section figures for one event day.
export function dayStats(rows: DayAttendanceRow[], eligible: StudentSummary[]) {
  const signedInIds = new Set(rows.filter((r) => r.signIn).map((r) => r.student.id));
  const completeIds = new Set(rows.filter((r) => r.signIn && r.signOut).map((r) => r.student.id));
  const missing = eligible.filter((s) => !signedInIds.has(s.id));

  const bySection = new Map<string, SectionStat>();
  for (const s of eligible) {
    const label = sectionLabel(s);
    const stat = bySection.get(label) ?? { label, expected: 0, signedIn: 0 };
    stat.expected++;
    if (signedInIds.has(s.id)) stat.signedIn++;
    bySection.set(label, stat);
  }
  const sections = [...bySection.values()].sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { numeric: true })
  );

  const expected = eligible.length;
  const expectedSignedIn = eligible.filter((s) => signedInIds.has(s.id)).length;
  const expectedComplete = eligible.filter((s) => completeIds.has(s.id)).length;
  return {
    expected,
    missing,
    sections,
    signedInRate: expected > 0 ? expectedSignedIn / expected : null,
    completeRate: expected > 0 ? expectedComplete / expected : null,
  };
}

export interface EventSummary {
  id: string;
  title: string;
  lastDay: string;
  expected: number; // student-days expected across the event's finished days
  signedIn: number; // of those, student-days with a sign-in
}

// Attendance rate per finished event in a semester (events with no semester
// count toward the active one), most recent first.
export async function loadSemesterSummary(
  client: SupabaseClient,
  semester: { id: string; is_active: boolean },
  now: number
): Promise<EventSummary[]> {
  const { data } = await client
    .from("events")
    .select("id, title, target_programs, target_year_levels, event_days(id, day_date, sign_out_end)")
    .or(semester.is_active ? `semester_id.eq.${semester.id},semester_id.is.null` : `semester_id.eq.${semester.id}`);
  type Ev = EventTargets & {
    id: string;
    title: string;
    event_days: { id: string; day_date: string; sign_out_end: string }[];
  };
  const events = ((data ?? []) as Ev[])
    .map((e) => ({ ...e, event_days: e.event_days.filter((d) => new Date(d.sign_out_end).getTime() <= now) }))
    .filter((e) => e.event_days.length > 0);
  if (events.length === 0) return [];

  const [byDay, everyone] = await Promise.all([
    loadDayAttendance(client, events.flatMap((e) => e.event_days.map((d) => d.id))),
    loadEligibleStudents(client, { target_programs: null, target_year_levels: null }),
  ]);

  return events
    .map((e) => {
      const eligibleIds = new Set(everyone.filter((s) => isEventForStudent(e, s)).map((s) => s.id));
      let signedIn = 0;
      for (const d of e.event_days) {
        signedIn += (byDay.get(d.id) ?? []).filter((r) => r.signIn && eligibleIds.has(r.student.id)).length;
      }
      return {
        id: e.id,
        title: e.title,
        lastDay: e.event_days.map((d) => d.day_date).sort().at(-1)!,
        expected: eligibleIds.size * e.event_days.length,
        signedIn,
      };
    })
    .sort((a, b) => b.lastDay.localeCompare(a.lastDay));
}
