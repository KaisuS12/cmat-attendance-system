import { describe, expect, it } from "vitest";
import { formatName, parseMasterlistTable, splitCourse } from "@/lib/masterlist";
import { isValidStudentId, normalizeStudentId } from "@/lib/constants";

// The layout of the school's "MASTER LIST" Excel file.
const schoolFile: string[][] = [
  [],
  ["", "", "MASTER LIST"],
  ["BSTM 1"],
  ["First Semester, Academic Year 2026-2027"],
  [],
  ["No", "Student Name", "", "Course"],
  [],
  ["Male"],
  ["1", "ARINO, REYMARK LIMACO", "", "BSTM 1"],
  ["2", "GARCIA, SHADSRAE SEREÑO", "", "BSTM 1"],
  [],
  ["Female"],
  ["1", "ALVAREZ, DAIZY HAGATARAS", "", "BSTM 1"],
  ["2", "BANDO, ALLEAH BACELONIA", "", "BSTM 1"],
  ["3", "BANDO, ALLEAH BACELONIA", "", "BSTM 1"], // duplicate line
];

describe("parseMasterlistTable", () => {
  it("reads the school masterlist layout", () => {
    const parsed = parseMasterlistTable(schoolFile);
    expect(parsed.error).toBeUndefined();
    expect(parsed.hasIds).toBe(false);
    expect(parsed.rows.map((r) => [r.fullName, r.program, r.yearLevel, r.studentId])).toEqual([
      ["Arino, Reymark Limaco", "BSTM", "1", ""],
      ["Garcia, Shadsrae Sereño", "BSTM", "1", ""],
      ["Alvarez, Daizy Hagataras", "BSTM", "1", ""],
      ["Bando, Alleah Bacelonia", "BSTM", "1", ""],
    ]);
    expect(parsed.skipped).toEqual([{ line: 15, text: "BANDO, ALLEAH BACELONIA", reason: "Duplicate in file" }]);
  });

  it("uses an ID column when present and falls back to a title-row course", () => {
    const parsed = parseMasterlistTable([
      ["BSBA-FM 4"],
      ["ID No.", "Name"],
      ["08-121207", "Gaudiano, Marvin"],
      ["bad id", "Someone Else"],
    ]);
    expect(parsed.rows).toEqual([
      { line: 3, studentId: "08-121207", fullName: "Gaudiano, Marvin", program: "BSBA-FM", yearLevel: "4", section: "" },
    ]);
    expect(parsed.skipped[0].reason).toBe("Unrecognized student ID format");
  });

  it("still reads the plain CSV template", () => {
    const parsed = parseMasterlistTable([
      ["student_id", "full_name", "program", "year_level", "section"],
      ["21-00123", "Juan Dela Cruz", "bsit", "3rd", "A"],
    ]);
    expect(parsed.rows[0]).toMatchObject({ studentId: "21-00123", fullName: "Juan Dela Cruz", program: "BSIT", yearLevel: "3", section: "A" });
  });

  it("explains a missing header", () => {
    expect(parseMasterlistTable([["hello"], ["world"]]).error).toMatch(/header/);
  });
});

describe("helpers", () => {
  it("splits course and year", () => {
    expect(splitCourse("BSTM 1")).toEqual({ program: "BSTM", yearLevel: "1", section: "" });
    expect(splitCourse("BSBA-FM 4")).toEqual({ program: "BSBA-FM", yearLevel: "4", section: "" });
    expect(splitCourse("BSIT 3A")).toEqual({ program: "BSIT", yearLevel: "3", section: "A" });
    expect(splitCourse("Undeclared")).toEqual({ program: "Undeclared", yearLevel: "", section: "" });
  });

  it("formats all-caps names, keeping suffixes and mixed-case input", () => {
    expect(formatName("DELA CRUZ, JUAN II")).toBe("Dela Cruz, Juan II");
    expect(formatName("O'NEIL-SANTOS ,  ANA")).toBe("O'Neil-Santos, Ana");
    expect(formatName("McArthur, Ian")).toBe("McArthur, Ian");
  });

  it("accepts generated IDs in any case", () => {
    expect(normalizeStudentId(" nam26-0001 ")).toBe("NAM26-0001");
    expect(isValidStudentId("NAM26-0001")).toBe(true);
    expect(isValidStudentId("NAM26-1")).toBe(false);
  });
});
