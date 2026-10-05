import { describe, expect, it } from "vitest";
import { cleanTargets, describeTargets, isEventForStudent, isTargeted } from "@/lib/eligibility";

const everyone = { target_programs: null, target_year_levels: null };

describe("isEventForStudent", () => {
  it("treats no targets (null or empty) as everyone", () => {
    expect(isEventForStudent(everyone, { program: "BSIT", year_level: "1" })).toBe(true);
    expect(isEventForStudent({ target_programs: [], target_year_levels: [] }, { program: null, year_level: null })).toBe(true);
  });

  it("matches programs ignoring case and extra whitespace", () => {
    const event = { target_programs: ["BSIT"], target_year_levels: null };
    expect(isEventForStudent(event, { program: " bsit ", year_level: "2" })).toBe(true);
    expect(isEventForStudent(event, { program: "BSA", year_level: "2" })).toBe(false);
    expect(isEventForStudent(event, { program: null, year_level: "2" })).toBe(false);
  });

  it("requires both program and year level when both are targeted", () => {
    const event = { target_programs: ["BSIT", "BSCS"], target_year_levels: ["3", "4"] };
    expect(isEventForStudent(event, { program: "BSCS", year_level: "4" })).toBe(true);
    expect(isEventForStudent(event, { program: "BSIT", year_level: "2" })).toBe(false);
    expect(isEventForStudent(event, { program: "BSA", year_level: "3" })).toBe(false);
  });
});

describe("describeTargets / isTargeted", () => {
  it("describes the audience", () => {
    expect(describeTargets(everyone)).toBe("All students");
    expect(describeTargets({ target_programs: ["BSIT"], target_year_levels: ["3", "4th Year"] })).toBe(
      "BSIT · Year 3, 4th Year"
    );
    expect(isTargeted(everyone)).toBe(false);
    expect(isTargeted({ target_programs: null, target_year_levels: ["1"] })).toBe(true);
  });
});

describe("cleanTargets", () => {
  it("trims, drops blanks and case-insensitive duplicates", () => {
    expect(cleanTargets([" BSIT ", "bsit", "", "BS  CS"])).toEqual(["BSIT", "BS CS"]);
  });

  it("returns null for everyone", () => {
    expect(cleanTargets([])).toBeNull();
    expect(cleanTargets(undefined)).toBeNull();
    expect(cleanTargets(["  "])).toBeNull();
  });
});
