import { describe, expect, it } from "vitest";
import { computeSemesterAnalytics, type DayAttendanceRow, type StudentSummary } from "@/lib/reports";

const student = (id: string, full_name: string, program: string, year_level: string): StudentSummary => ({
  id,
  student_id: id,
  full_name,
  program,
  year_level,
  section: "A",
});

const ana = student("a", "Ana", "BSIT", "3");
const ben = student("b", "Ben", "BSIT", "4");
const cara = student("c", "Cara", "BSA", "3");

const entry = (method: "qr" | "manual") => ({ id: Math.random().toString(), at: "2026-10-01T00:00:00Z", method, reason: null });

const NOW = Date.parse("2026-10-10T00:00:00Z");

const events = [
  {
    id: "e1",
    title: "Assembly",
    target_programs: null,
    target_year_levels: null,
    event_days: [{ id: "d1", day_date: "2026-10-01", sign_out_end: "2026-10-01T09:00:00Z" }],
  },
  {
    id: "e2",
    title: "BSIT Seminar",
    target_programs: ["BSIT"],
    target_year_levels: null,
    event_days: [{ id: "d2", day_date: "2026-10-05", sign_out_end: "2026-10-05T09:00:00Z" }],
  },
  {
    id: "e3",
    title: "Upcoming",
    target_programs: null,
    target_year_levels: null,
    event_days: [{ id: "d3", day_date: "2026-10-20", sign_out_end: "2026-10-20T09:00:00Z" }],
  },
];

const byDay = new Map<string, DayAttendanceRow[]>([
  [
    "d1",
    [
      { student: ana, signIn: entry("qr"), signOut: entry("qr") },
      { student: ben, signIn: entry("manual"), signOut: null },
    ],
  ],
  ["d2", [{ student: ana, signIn: entry("qr"), signOut: entry("qr") }]],
  // Unfinished day: must be ignored even if it has records.
  ["d3", [{ student: cara, signIn: entry("qr"), signOut: entry("qr") }]],
]);

const result = computeSemesterAnalytics({ events, byDay, students: [ana, ben, cara], now: NOW });

describe("computeSemesterAnalytics", () => {
  it("counts only finished events and eligible students", () => {
    expect(result.eventsHeld).toBe(2);
    expect(result.trend.map((t) => [t.title, t.signedIn, t.expected])).toEqual([
      ["Assembly", 2, 3],
      ["BSIT Seminar", 1, 2], // Cara (BSA) isn't expected at a BSIT event
    ]);
    expect(result.averageRate).toBeCloseTo(3 / 5);
  });

  it("splits sign-ins by method", () => {
    expect(result.methods).toEqual({ qr: 2, manual: 1 });
    expect(result.totalCheckIns).toBe(3);
  });

  it("groups by program and year level, highest rate first", () => {
    expect(result.byProgram.map((g) => [g.label, g.signedIn, g.expected])).toEqual([
      ["BSIT", 3, 4],
      ["BSA", 0, 1],
    ]);
    expect(result.byYear.map((g) => [g.label, g.signedIn, g.expected])).toEqual([
      ["Year 3", 2, 3],
      ["Year 4", 1, 2],
    ]);
  });

  it("lists students below the threshold, lowest first", () => {
    // Ben signed in but never out (0/2); Cara missed the one event meant for her (0/1).
    expect(result.watchCount).toBe(2);
    expect(result.watchList.map((w) => [w.student.full_name, w.attended, w.required])).toEqual([
      ["Ben", 0, 2],
      ["Cara", 0, 1],
    ]);
  });

  it("summarises recent events, newest first", () => {
    expect(result.recent.map((r) => r.title)).toEqual(["BSIT Seminar", "Assembly"]);
  });
});
