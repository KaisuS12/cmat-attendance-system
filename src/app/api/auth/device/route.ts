import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { getCurrentProfile } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkStudentDevice, DEVICE_COOKIE, deviceCookieOptions, newDeviceId } from "@/lib/devices";

// Called right after logging in: remembers this phone for a student account,
// or refuses it (the login form then signs out and shows why). Staff
// accounts have no phone limit.
export async function POST() {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  if (profile.role !== "student") return NextResponse.json({ ok: true });

  const jar = await cookies();
  const deviceId = jar.get(DEVICE_COOKIE)?.value ?? newDeviceId();
  const userAgent = (await headers()).get("user-agent");

  const check = await checkStudentDevice(createAdminClient(), profile.id, deviceId, userAgent);
  const res = check.ok
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: check.message, reason: check.reason }, { status: 403 });
  res.cookies.set(DEVICE_COOKIE, deviceId, deviceCookieOptions);
  return res;
}
