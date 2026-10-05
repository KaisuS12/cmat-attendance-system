import { describe, expect, it } from "vitest";
import { distanceMeters, isWithinVenue } from "@/lib/geofence";
import { isValidStudentId, studentIdToEmail } from "@/lib/constants";
import { dayWindowProblem } from "@/lib/windows";
import { daySchema } from "@/lib/schemas";
import { generateTempPassword } from "@/lib/passwords";

describe("geofence", () => {
  it("measures short distances accurately", () => {
    // ~111 m per 0.001° of latitude.
    const d = distanceMeters(14.6, 121.0, 14.601, 121.0);
    expect(d).toBeGreaterThan(110);
    expect(d).toBeLessThan(112);
  });

  it("checks the radius inclusively", () => {
    expect(isWithinVenue(14.6, 121.0, 14.6, 121.0, 0)).toBe(true);
    expect(isWithinVenue(14.601, 121.0, 14.6, 121.0, 100)).toBe(false);
    expect(isWithinVenue(14.601, 121.0, 14.6, 121.0, 150)).toBe(true);
  });
});

describe("student IDs", () => {
  it("accepts the default 21-00123 style", () => {
    expect(isValidStudentId("21-00123")).toBe(true);
    expect(isValidStudentId(" 21-00123 ")).toBe(true);
    expect(isValidStudentId("2100123")).toBe(false);
    expect(isValidStudentId("21-00123; drop")).toBe(false);
  });

  it("maps IDs to the synthetic login email", () => {
    expect(studentIdToEmail(" 21-00123 ")).toBe("21-00123@students.cmat-council.internal");
  });
});

describe("event day windows", () => {
  const ok = {
    signInStart: "2026-09-28T00:00:00Z",
    signInEnd: "2026-09-28T01:00:00Z",
    signOutStart: "2026-09-28T08:00:00Z",
    signOutEnd: "2026-09-28T09:00:00Z",
  };

  it("accepts a normal day", () => {
    expect(dayWindowProblem(ok)).toBeNull();
    expect(daySchema.safeParse({ dayDate: "2026-09-28", ...ok }).success).toBe(true);
  });

  it("rejects backwards windows", () => {
    expect(dayWindowProblem({ ...ok, signInEnd: ok.signInStart })?.field).toBe("signInEnd");
    expect(dayWindowProblem({ ...ok, signOutEnd: "2026-09-28T07:00:00Z" })?.field).toBe("signOutEnd");
    expect(dayWindowProblem({ ...ok, signOutStart: "2026-09-27T23:00:00Z", signOutEnd: "2026-09-28T09:00:00Z" })?.field).toBe(
      "signOutStart"
    );
  });

  it("rejects timestamps without an offset", () => {
    expect(daySchema.safeParse({ dayDate: "2026-09-28", ...ok, signInStart: "2026-09-28T08:00" }).success).toBe(false);
  });
});

describe("temporary passwords", () => {
  it("are 10 unambiguous characters and not repeated", () => {
    const a = generateTempPassword();
    expect(a).toMatch(/^[A-HJ-NP-Za-km-z2-9]{10}$/);
    expect(generateTempPassword()).not.toBe(a);
  });
});

describe("describeDistance", () => {
  it("compares radii to football fields and walking time", async () => {
    const { describeDistance } = await import("@/lib/geofence");
    expect(describeDistance(150)).toBe("about 1½ football fields · about a 2-minute walk from the center");
    expect(describeDistance(100)).toBe("about 1 football field · about a 1-minute walk from the center");
    expect(describeDistance(50)).toBe("less than a football field · about a 1-minute walk from the center");
    expect(describeDistance(300)).toBe("about 3 football fields · about a 4-minute walk from the center");
    expect(describeDistance(0)).toBe("");
  });
});
