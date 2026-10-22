import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

// Phones per student account (see migration 0010). Each account works on at
// most MAX_STUDENT_DEVICES phones, and each phone for only one student.
export const MAX_STUDENT_DEVICES = 2;
export const DEVICE_COOKIE = "nam_device";

export const deviceCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 400, // as long as browsers allow
};

export function newDeviceId(): string {
  return randomUUID();
}

const hash = (deviceId: string) => createHash("sha256").update(deviceId).digest("hex");

export type DeviceCheck =
  | { ok: true }
  | { ok: false; reason: "other_account" | "too_many"; message: string };

/** Records this phone for the student, or explains why it can't be used. */
export async function checkStudentDevice(
  admin: SupabaseClient,
  profileId: string,
  deviceId: string,
  userAgent: string | null
): Promise<DeviceCheck> {
  const deviceHash = hash(deviceId);
  const [{ data: onThisPhone }, { data: mine }] = await Promise.all([
    admin.from("student_devices").select("profile_id").eq("device_hash", deviceHash),
    admin.from("student_devices").select("id, device_hash").eq("profile_id", profileId),
  ]);

  if ((onThisPhone ?? []).some((d) => d.profile_id !== profileId)) {
    return {
      ok: false,
      reason: "other_account",
      message:
        "This phone is already used by another student's account. Each phone can only be used for one student. Use your own phone, or ask an officer.",
    };
  }

  const known = (mine ?? []).find((d) => d.device_hash === deviceHash);
  if (known) {
    await admin.from("student_devices").update({ last_seen: new Date().toISOString() }).eq("id", known.id);
    return { ok: true };
  }

  if ((mine ?? []).length >= MAX_STUDENT_DEVICES) {
    return {
      ok: false,
      reason: "too_many",
      message: `Your account is already used on ${MAX_STUDENT_DEVICES} phones. Use one of those, or ask a council officer to reset your phones.`,
    };
  }

  const { error } = await admin
    .from("student_devices")
    .insert({ profile_id: profileId, device_hash: deviceHash, user_agent: userAgent?.slice(0, 300) ?? null });
  // Two requests racing on a brand-new phone: the other one saved it.
  if (error && error.code !== "23505") return { ok: true };
  return { ok: true };
}
