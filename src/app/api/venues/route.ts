import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

// Saved venues, so recurring locations (the covered court, the gym) are
// picked from a list instead of re-entering coordinates for every event.
export async function GET() {
  const { error } = await requireRole("officer", "admin");
  if (error) return error;

  const admin = createAdminClient();
  const { data, error: queryError } = await admin.from("venues").select("*").order("name");

  if (queryError) return NextResponse.json({ error: queryError.message }, { status: 500 });

  // Old events each created their own venue row; collapse same-name,
  // same-spot duplicates so the picker stays short.
  const seen = new Set<string>();
  const venues = (data ?? []).filter((v) => {
    const key = `${v.name.trim().toLowerCase()}|${v.latitude.toFixed(5)}|${v.longitude.toFixed(5)}|${v.radius_meters}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return NextResponse.json({ venues });
}
