import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { checkStudentDevice, MAX_STUDENT_DEVICES } from "@/lib/devices";

// A tiny in-memory stand-in for the student_devices table.
function fakeDb() {
  const rows: { id: string; profile_id: string; device_hash: string }[] = [];
  const client = {
    from: () => ({
      select: () => ({
        eq: (col: string, val: string) =>
          Promise.resolve({ data: rows.filter((r) => (r as Record<string, string>)[col] === val), error: null }),
      }),
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      insert: (row: { profile_id: string; device_hash: string }) => {
        rows.push({ id: String(rows.length + 1), ...row });
        return Promise.resolve({ error: null });
      },
    }),
  };
  return { db: client as unknown as SupabaseClient, rows };
}

describe("checkStudentDevice", () => {
  it(`allows up to ${MAX_STUDENT_DEVICES} phones per account, then refuses`, async () => {
    const { db } = fakeDb();
    expect((await checkStudentDevice(db, "ana", "phone-1", null)).ok).toBe(true);
    expect((await checkStudentDevice(db, "ana", "phone-1", null)).ok).toBe(true); // same phone again
    expect((await checkStudentDevice(db, "ana", "phone-2", null)).ok).toBe(true);
    const third = await checkStudentDevice(db, "ana", "phone-3", null);
    expect(third).toMatchObject({ ok: false, reason: "too_many" });
  });

  it("refuses a phone already used by another student (buddy sign-in)", async () => {
    const { db } = fakeDb();
    await checkStudentDevice(db, "ben", "bens-phone", null);
    const buddy = await checkStudentDevice(db, "ana", "bens-phone", null);
    expect(buddy).toMatchObject({ ok: false, reason: "other_account" });
  });
});
