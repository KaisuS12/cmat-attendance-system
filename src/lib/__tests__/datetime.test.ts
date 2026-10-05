import { describe, expect, it } from "vitest";
import {
  formatDayDate,
  formatTime,
  isoToLocalInput,
  localInputToIso,
  todayInAppTz,
  windowState,
} from "@/lib/datetime";

describe("datetime (Asia/Manila, UTC+8)", () => {
  it("round-trips datetime-local values through ISO without shifting", () => {
    const iso = localInputToIso("2026-09-28T08:30");
    expect(iso).toBe("2026-09-28T00:30:00.000Z");
    expect(isoToLocalInput(iso!)).toBe("2026-09-28T08:30");
  });

  it("reads Supabase timestamptz strings in Manila time", () => {
    // What the old `.slice(0, 16)` got wrong: this is 09:00 in Manila, not 01:00.
    expect(isoToLocalInput("2026-09-28T01:00:00+00:00")).toBe("2026-09-28T09:00");
  });

  it("rejects malformed datetime-local input instead of throwing", () => {
    expect(localInputToIso("")).toBeNull();
    expect(localInputToIso("2026-09-28")).toBeNull();
    expect(localInputToIso("not a date")).toBeNull();
  });

  it("formats times in Manila regardless of the host timezone", () => {
    expect(formatTime("2026-09-28T00:30:00Z")).toBe("8:30 AM");
  });

  it("formats date columns without sliding a day", () => {
    expect(formatDayDate("2026-09-28", "numeric")).toBe("Sep 28, 2026");
    expect(formatDayDate("2026-01-01", "short")).toBe("Thu, Jan 1");
  });

  it("computes today's date in Manila", () => {
    // 20:00 UTC on the 27th is already 04:00 on the 28th in Manila.
    expect(todayInAppTz(new Date("2026-09-27T20:00:00Z"))).toBe("2026-09-28");
  });

  it("classifies window state", () => {
    const start = "2026-09-28T00:00:00Z";
    const end = "2026-09-28T01:00:00Z";
    expect(windowState(start, end, Date.parse("2026-09-27T23:59:00Z"))).toBe("not_open");
    expect(windowState(start, end, Date.parse("2026-09-28T00:30:00Z"))).toBe("open");
    expect(windowState(start, end, Date.parse("2026-09-28T01:00:01Z"))).toBe("closed");
  });
});
