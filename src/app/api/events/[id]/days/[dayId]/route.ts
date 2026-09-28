import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

// Partial update of a single day's windows — this is what lets an officer
// extend sign-in by e.g. 15 minutes mid-event (§4.1). Because
// generate-token always reads the current row, an extension takes effect
// immediately for anyone who hasn't signed in yet — no separate "push" needed.
const bodySchema = z.object({
  signInStart: z.string().optional(),
  signInEnd: z.string().optional(),
  signOutStart: z.string().optional(),
  signOutEnd: z.string().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; dayId: string }> }
) {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "officer" && profile.role !== "admin")) {
    return NextResponse.json({ error: "Officers only." }, { status: 403 });
  }

  const { dayId } = await params;
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const updates: Record<string, string> = {};
  if (parsed.data.signInStart) updates.sign_in_start = parsed.data.signInStart;
  if (parsed.data.signInEnd) updates.sign_in_end = parsed.data.signInEnd;
  if (parsed.data.signOutStart) updates.sign_out_start = parsed.data.signOutStart;
  if (parsed.data.signOutEnd) updates.sign_out_end = parsed.data.signOutEnd;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update." }, { status: 400 });
  }
  updates.updated_at = new Date().toISOString();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("event_days")
    .update(updates)
    .eq("id", dayId)
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Could not update event day." }, { status: 500 });
  }

  await logAudit({
    actorId: profile.id,
    action: "event_day_window_updated",
    entityType: "event_days",
    entityId: dayId,
    details: updates,
  });

  return NextResponse.json({ eventDay: data });
}
