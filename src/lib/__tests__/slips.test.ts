import { describe, expect, it } from "vitest";
import { groupSlips, slipGroupLabel } from "@/lib/slips";

describe("slipGroupLabel", () => {
  it("combines program and year", () => {
    expect(slipGroupLabel({ program: "BSIT", yearLevel: "3" })).toBe("BSIT 3");
    expect(slipGroupLabel({ program: "BSA", yearLevel: null })).toBe("BSA");
    expect(slipGroupLabel({ program: " ", yearLevel: "" })).toBe("Unassigned");
  });
});

describe("groupSlips", () => {
  it("groups by program and year, sorts groups naturally and names alphabetically", () => {
    const groups = groupSlips([
      { studentId: "1", fullName: "Zed", tempPassword: "x", program: "BSIT", yearLevel: "10" },
      { studentId: "2", fullName: "Ana", tempPassword: "x", program: "BSIT", yearLevel: "2" },
      { studentId: "3", fullName: "Ben", tempPassword: "x", program: "BSIT", yearLevel: "10" },
    ]);
    expect(groups.map((g) => g.label)).toEqual(["BSIT 2", "BSIT 10"]);
    expect(groups[1].slips.map((s) => s.fullName)).toEqual(["Ben", "Zed"]);
  });
});
