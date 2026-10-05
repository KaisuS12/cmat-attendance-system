import { describe, expect, it } from "vitest";
import { parseCsv, toCsv } from "@/lib/csv";

describe("parseCsv", () => {
  it("parses quoted cells, escaped quotes, CRLF and a BOM", () => {
    const text = '﻿student_id,full_name\r\n21-00123,"Dela Cruz, Juan ""JD"""\r\n21-00124,Maria\r\n';
    expect(parseCsv(text)).toEqual([
      ["student_id", "full_name"],
      ["21-00123", 'Dela Cruz, Juan "JD"'],
      ["21-00124", "Maria"],
    ]);
  });

  it("keeps newlines inside quoted cells and drops blank lines", () => {
    expect(parseCsv('a,b\n\n"line1\nline2",x\n,\n')).toEqual([
      ["a", "b"],
      ["line1\nline2", "x"],
    ]);
  });

  it("handles a last row without a trailing newline", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("toCsv", () => {
  it("adds a BOM, quotes special cells and round-trips", () => {
    const rows = [
      ["Name", "Note"],
      ["Peña, José", 'said "hi"'],
    ];
    const csv = toCsv(rows);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(parseCsv(csv)).toEqual(rows);
  });

  it("neutralizes spreadsheet formulas but keeps IDs and negatives", () => {
    const csv = toCsv([["=HYPERLINK(1)", "+1", "@x", "-cmd", "21-00123", "-5"]]);
    expect(parseCsv(csv)[0]).toEqual(["'=HYPERLINK(1)", "'+1", "'@x", "'-cmd", "21-00123", "-5"]);
  });

  it("writes null and undefined as empty cells", () => {
    expect(toCsv([[null, undefined, 0]])).toBe("﻿,,0\r\n");
  });
});
