import { describe, expect, it } from "vitest";
import { describeAuditEntry, emptyAuditNames, type AuditDescription } from "@/lib/audit-describe";

const VENUE = "80523855-8af4-4fe7-9dbc-67dd27a3613a";
const EVENT = "11111111-2222-4333-8444-555555555555";
const DAY = "66666666-7777-4888-8999-aaaaaaaaaaaa";
const STUDENT = "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff";

const names = () => {
  const n = emptyAuditNames();
  n.events.set(EVENT, "General Assembly");
  n.days.set(DAY, { day_date: "2026-11-20", session: "Morning", event_id: EVENT, eventTitle: "General Assembly" });
  n.people.set(STUDENT, "Dela Cruz, Juan");
  n.venues.set(VENUE, "CMAT Gym");
  return n;
};

const flat = (r: AuditDescription) => JSON.stringify(r);

describe("describeAuditEntry", () => {
  it("reads the event edit from the screenshot as plain changes", () => {
    const r = describeAuditEntry(
      {
        action: "event_updated",
        entity_type: "events",
        entity_id: EVENT,
        details: {
          before: { title: "test1", venue_id: VENUE, description: "wsasa", target_programs: ["BSIT"], target_year_levels: ["4"] },
          after: {
            title: "test1",
            venue_id: VENUE,
            description: "wsasa",
            target_programs: ["BSIT", "BSMA", "BSTM", "BSBA MM", "BSBA FM", "BSA"],
            target_year_levels: ["4", "3", "2", "1"],
          },
        },
      },
      names()
    );
    expect(r.sentence).toBe("Edited the event “General Assembly”");
    expect(r.changes).toEqual([
      { label: "Programs", from: "BSIT", to: "BSIT, BSMA, BSTM, BSBA MM, BSBA FM, BSA" },
      { label: "Year levels", from: "4", to: "4, 3, 2, 1" },
    ]);
    expect(r.href?.url).toBe(`/officer/events/${EVENT}`);
  });

  it("shows venue names and 'All programs' instead of ids and empty lists", () => {
    const r = describeAuditEntry(
      {
        action: "event_updated",
        entity_type: "events",
        entity_id: EVENT,
        details: { before: { venue_id: VENUE, target_programs: ["BSIT"] }, after: { venue_id: "nope", target_programs: null } },
      },
      names()
    );
    expect(r.changes).toEqual([
      { label: "Venue", from: "CMAT Gym", to: "another venue" },
      { label: "Programs", from: "BSIT", to: "All programs" },
    ]);
  });

  it("describes time changes in Manila time", () => {
    const r = describeAuditEntry(
      {
        action: "event_day_window_updated",
        entity_type: "event_days",
        entity_id: DAY,
        details: {
          before: { sign_in_start: "2026-11-19T23:30:00Z", sign_in_end: "2026-11-20T00:30:00Z", sign_out_start: "2026-11-20T08:00:00Z", sign_out_end: "2026-11-20T09:00:00Z" },
          after: { sign_in_start: "2026-11-19T23:30:00Z", sign_in_end: "2026-11-20T00:45:00Z", sign_out_start: "2026-11-20T08:00:00Z", sign_out_end: "2026-11-20T09:00:00Z" },
        },
      },
      names()
    );
    expect(r.sentence).toBe("Changed the times of “General Assembly” · Fri, Nov 20 · Morning");
    expect(r.changes).toEqual([{ label: "Sign-in", from: "7:30–8:30 AM", to: "7:30–8:45 AM" }]);
  });

  it("describes manual entries, imports and role changes", () => {
    const manual = describeAuditEntry(
      {
        action: "attendance_manual_entry",
        entity_type: "attendance_records",
        entity_id: null,
        details: { studentId: STUDENT, studentName: "Dela Cruz, Juan", eventDayId: DAY, type: "sign_in", reason: "phone battery dead", hasPhoto: true },
      },
      names()
    );
    expect(manual.sentence).toBe("Manually signed in Dela Cruz, Juan at “General Assembly” · Fri, Nov 20 · Morning (with ID photo)");
    expect(manual.note).toBe("Reason: phone battery dead");

    expect(
      describeAuditEntry(
        { action: "students_bulk_imported", entity_type: "profiles", entity_id: null, details: { total: 55, created: 50, updated: 2, existing: 3, failed: 0 } },
        names()
      ).sentence
    ).toBe("Imported a masterlist: 50 new, 2 updated, 3 already existed");

    expect(
      describeAuditEntry(
        { action: "role_changed", entity_type: "profiles", entity_id: STUDENT, details: { fullName: "Pao", from: "officer", to: "admin" } },
        names()
      ).sentence
    ).toBe("Made Pao an admin");
  });

  it("never shows raw ids or JSON, even for unknown or empty entries", () => {
    const unknown = describeAuditEntry(
      { action: "something_new", entity_type: "x", entity_id: EVENT, details: { eventId: EVENT, count: 3, label: "hello" } },
      emptyAuditNames()
    );
    expect(unknown.sentence).toBe("Something new");
    expect(unknown.note).toBe("Count: 3 · Label: hello");

    const missing = describeAuditEntry({ action: "event_day_added", entity_type: "event_days", entity_id: DAY, details: null }, emptyAuditNames());
    expect(missing.sentence).toBe("Added a day to an event that was later deleted");

    for (const r of [unknown, missing]) {
      expect(flat({ ...r, href: undefined })).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/);
      expect(r.sentence + (r.note ?? "")).not.toContain("{");
    }
  });
});
