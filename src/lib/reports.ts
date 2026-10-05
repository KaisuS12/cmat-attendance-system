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

export interface AnalyticsEvent extends EventTargets {
  id: string;
  title: string;
  event_days: { id: string; day_date: string; sign_out_end: string }[];
}

export interface TrendPoint {
  dayId: string;
  eventId: string;
  title: string;
  date: string;
  expected: number;
  signedIn: number;
  rate: number; // 0–1
}

export interface GroupStat {
  label: string;
  expected: number;
  signedIn: number;
  rate: number; // 0–1
}

export interface WatchRow {
  student: StudentSummary;
  attended: number; // finished required days with sign-in and sign-out
  required: number; // finished days of events meant for this student
  rate: number; // 0–1
}

export interface SemesterAnalytics {
  eventsHeld: number;
  averageRate: number | null;
  totalCheckIns: number;
  watchCount: number;
  trend: TrendPoint[];
  byProgram: GroupStat[];
  byYear: GroupStat[];
  methods: { qr: number; manual: number };
  watchList: WatchRow[];
  recent: EventSummary[];
}

// A student is "to watch" below this share of required days attended.
export const WATCH_THRESHOLD = 0.5;
const WATCH_LIST_SIZE = 10;

function yearLabel(value: string | null): string {
  const v = (value ?? "").trim();
  if (!v) return "Unassigned";
  return /^\d+$/.test(v) ? `Year ${v}` : v;
}

function groupKey(value: string | null): string {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

// Pure aggregation behind the dashboard analytics, kept separate from the
// database calls so it can be unit-tested. Only finished event days count,
// and each event only counts the students it was meant for.
export function computeSemesterAnalytics({
  events,
  byDay,
  students,
  now,
}: {
  events: AnalyticsEvent[];
  byDay: Map<string, DayAttendanceRow[]>;
  students: StudentSummary[];
  now: number;
}): SemesterAnalytics {
  const finished = events
    .map((e) => ({
      ...e,
      event_days: e.event_days
        .filter((d) => new Date(d.sign_out_end).getTime() <= now)
        .sort((a, b) => a.day_date.localeCompare(b.day_date)),
    }))
    .filter((e) => e.event_days.length > 0);

  const trend: TrendPoint[] = [];
  const recent: EventSummary[] = [];
  const programs = new Map<string, GroupStat>();
  const years = new Map<string, GroupStat>();
  const perStudent = new Map<string, WatchRow>();
  const methods = { qr: 0, manual: 0 };
  let totalExpected = 0;
  let totalSignedIn = 0;

  const bump = (map: Map<string, GroupStat>, key: string, label: string, signedIn: boolean) => {
    const stat = map.get(key) ?? { label, expected: 0, signedIn: 0, rate: 0 };
    stat.expected++;
    if (signedIn) stat.signedIn++;
    map.set(key, stat);
  };

  for (const event of finished) {
    const eligible = students.filter((s) => isEventForStudent(event, s));
    let eventSignedIn = 0;

    for (const day of event.event_days) {
      const rows = byDay.get(day.id) ?? [];
      const signedInIds = new Set<string>();
      const completeIds = new Set<string>();
      for (const r of rows) {
        if (r.signIn) {
          signedInIds.add(r.student.id);
          if (r.signIn.method === "manual") methods.manual++;
          else methods.qr++;
        }
        if (r.signIn && r.signOut) completeIds.add(r.student.id);
      }

      let daySignedIn = 0;
      for (const s of eligible) {
        const inToday = signedInIds.has(s.id);
        if (inToday) daySignedIn++;
        bump(programs, groupKey(s.program) || "~", s.program?.trim() || "Unassigned", inToday);
        bump(years, groupKey(s.year_level) || "~", yearLabel(s.year_level), inToday);

        const w = perStudent.get(s.id) ?? { student: s, attended: 0, required: 0, rate: 0 };
        w.required++;
        if (completeIds.has(s.id)) w.attended++;
        perStudent.set(s.id, w);
      }

      trend.push({
        dayId: day.id,
        eventId: event.id,
        title: event.title,
        date: day.day_date,
        expected: eligible.length,
        signedIn: daySignedIn,
        rate: eligible.length > 0 ? daySignedIn / eligible.length : 0,
      });
      eventSignedIn += daySignedIn;
      totalExpected += eligible.length;
      totalSignedIn += daySignedIn;
    }

    recent.push({
      id: event.id,
      title: event.title,
      lastDay: event.event_days[event.event_days.length - 1].day_date,
      expected: eligible.length * event.event_days.length,
      signedIn: eventSignedIn,
    });
  }

  trend.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
  recent.sort((a, b) => b.lastDay.localeCompare(a.lastDay));

  const finalize = (map: Map<string, GroupStat>) =>
    [...map.values()]
      .map((g) => ({ ...g, rate: g.expected > 0 ? g.signedIn / g.expected : 0 }))
      .sort((a, b) => b.rate - a.rate || a.label.localeCompare(b.label, undefined, { numeric: true }));

  const watching = [...perStudent.values()]
    .map((w) => ({ ...w, rate: w.required > 0 ? w.attended / w.required : 1 }))
    .filter((w) => w.required > 0 && w.rate < WATCH_THRESHOLD)
    .sort((a, b) => a.rate - b.rate || a.student.full_name.localeCompare(b.student.full_name));

  return {
    eventsHeld: finished.length,
    averageRate: totalExpected > 0 ? totalSignedIn / totalExpected : null,
    totalCheckIns: methods.qr + methods.manual,
    watchCount: watching.length,
    trend,
    byProgram: finalize(programs),
    byYear: finalize(years),
    methods,
    watchList: watching.slice(0, WATCH_LIST_SIZE),
    recent,
  };
}

// Loads everything the dashboard analytics need for one semester (events
// with no semester count toward the active one).
export async function loadSemesterAnalytics(
  client: SupabaseClient,
  semester: { id: string; is_active: boolean },
  now: number
): Promise<SemesterAnalytics> {
  const { data } = await client
    .from("events")
    .select("id, title, target_programs, target_year_levels, event_days(id, day_date, sign_out_end)")
    .or(semester.is_active ? `semester_id.eq.${semester.id},semester_id.is.null` : `semester_id.eq.${semester.id}`);
  const events = (data ?? []) as AnalyticsEvent[];

  const finishedDayIds = events.flatMap((e) =>
    e.event_days.filter((d) => new Date(d.sign_out_end).getTime() <= now).map((d) => d.id)
  );
  const [byDay, students] = await Promise.all([
    loadDayAttendance(client, finishedDayIds),
    loadEligibleStudents(client, { target_programs: null, target_year_levels: null }),
  ]);

  return computeSemesterAnalytics({ events, byDay, students, now });
}
