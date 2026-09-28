import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id } = await params;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("events")
    .select("*, venues(*), event_days(*)")
    .eq("id", id)
    .single();

  if (error || !data) return NextResponse.json({ error: "Event not found." }, { status: 404 });
  return NextResponse.json({ event: data });
}
