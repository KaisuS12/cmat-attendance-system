import { describe, expect, it } from "vitest";
import { planPromotion, programKey, type PromotionStudent } from "@/lib/school-year";

const student = (id: string, program: string | null, year: string | null, graduated_at: string | null = null): PromotionStudent => ({
  id,
  full_name: `Student ${id}`,
  student_id: `NAM26-${id}`,
  program,
  year_level: year,
  graduated_at,
});

describe("planPromotion", () => {
  const programYears = new Map([["BSA", 5]]);
  const plan = planPromotion(
    [
      student("1", "BSTM", "1"),
      student("2", "BSTM", "4"),
      student("3", "BSA", "4"),
      student("4", " bsa ", "5"),
      student("5", "BSIT", "Irregular"),
      student("6", "BSTM", "3", "2026-06-01T00:00:00Z"),
      student("7", null, "2"),
    ],
    programYears
  );

  it("moves students up a year, or graduates them after their program's last year", () => {
    expect(plan.changes).toEqual([
      { id: "1", from: "1", to_year: "2", graduated: false },
      { id: "2", from: "4", to_year: null, graduated: true },
      { id: "3", from: "4", to_year: "5", graduated: false }, // BSA runs 5 years
      { id: "4", from: "5", to_year: null, graduated: true },
      { id: "7", from: "2", to_year: "3", graduated: false },
    ]);
    expect(plan.promoted).toBe(3);
    expect(plan.graduating).toBe(2);
  });

  it("skips non-numeric years and ignores students who already graduated", () => {
    expect(plan.skipped.map((s) => s.id)).toEqual(["5"]);
    expect(plan.changes.some((c) => c.id === "6")).toBe(false);
  });

  it("summarizes per program", () => {
    expect(plan.byProgram).toEqual([
      { program: "BSA", years: 5, promoted: 1, graduating: 1 },
      { program: "BSTM", years: 4, promoted: 1, graduating: 1 },
      { program: "Unassigned", years: 4, promoted: 1, graduating: 0 },
    ]);
  });

  it("normalizes program names", () => {
    expect(programKey("  bs  tm ")).toBe("BS TM");
  });
});

describe("past semesters after a promotion", () => {
  it("a past event for 3rd years still counts a student who is now in 4th year", async () => {
    const { asOfSemester } = await import("@/lib/reports");
    const { isEventForStudent } = await import("@/lib/eligibility");
    const now = { id: "s1", program: "BSTM", year_level: "4" };
    const roster = new Map([["s1", { program: "BSTM", year_level: "3" }]]);
    const event = { target_programs: ["BSTM"], target_year_levels: ["3"] };
    expect(isEventForStudent(event, now)).toBe(false); // current year alone would say "N/A"
    expect(isEventForStudent(event, asOfSemester(now, roster))).toBe(true);
    expect(asOfSemester(now, null)).toBe(now);
  });
});

describe("isComplete", () => {
  it("needs sign-out only when the slot requires it", async () => {
    const { isComplete } = await import("@/lib/attendance-status");
    expect(isComplete({ signIn: {}, signOut: null }, { sign_out_required: true })).toBe(false);
    expect(isComplete({ signIn: {}, signOut: null }, { sign_out_required: false })).toBe(true);
    expect(isComplete({ signIn: null, signOut: null }, { sign_out_required: false })).toBe(false);
    expect(isComplete({ signIn: {}, signOut: {} }, {})).toBe(true);
  });

  it("skips sign-out window checks for sign-in-only slots", async () => {
    const { dayWindowProblem } = await import("@/lib/windows");
    const w = { signInStart: "2026-10-23T07:30:00+08:00", signInEnd: "2026-10-23T08:30:00+08:00", signOutStart: "2026-10-23T08:30:00+08:00", signOutEnd: "2026-10-23T08:30:00+08:00" };
    expect(dayWindowProblem(w)?.field).toBe("signOutEnd");
    expect(dayWindowProblem(w, false)).toBeNull();
  });
});
