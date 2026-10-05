import { describe, expect, it } from "vitest";
import { groupSlips, slipGroupLabel } from "@/lib/slips";

describe("slipGroupLabel", () => {
  it("combines program, year and section", () => {
    expect(slipGroupLabel({ program: "BSIT", yearLevel: "3", section: "A" })).toBe("BSIT 3-A");
    expect(slipGroupLabel({ program: "BSA", yearLevel: null, section: null })).toBe("BSA");
    expect(slipGroupLabel({ program: " ", yearLevel: "", section: undefined })).toBe("Unassigned");
  });
});

describe("groupSlips", () => {
  it("groups by section, sorts groups naturally and names alphabetically", () => {
    const groups = groupSlips([
      { studentId: "1", fullName: "Zed", tempPassword: "x", program: "BSIT", yearLevel: "10", section: "A" },
      { studentId: "2", fullName: "Ana", tempPassword: "x", program: "BSIT", yearLevel: "2", section: "A" },
      { studentId: "3", fullName: "Ben", tempPassword: "x", program: "BSIT", yearLevel: "10", section: "A" },
    ]);
    expect(groups.map((g) => g.label)).toEqual(["BSIT 2-A", "BSIT 10-A"]);
    expect(groups[1].slips.map((s) => s.fullName)).toEqual(["Ben", "Zed"]);
  });
});
