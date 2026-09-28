import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin.from("semesters").select("*").order("start_date", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ semesters: data });
}

const bodySchema = z.object({
  name: z.string().min(1),
  startDate: z.string(),
  endDate: z.string(),
  makeActive: z.boolean().default(false),
});

export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { name, startDate, endDate, makeActive } = parsed.data;

  const admin = createAdminClient();

  if (makeActive) {
    await admin.from("semesters").update({ is_active: false }).eq("is_active", true);
  }

  const { data, error } = await admin
    .from("semesters")
    .insert({ name, start_date: startDate, end_date: endDate, is_active: makeActive })
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Could not create semester." }, { status: 500 });
  }

  await logAudit({
    actorId: profile.id,
    action: "semester_created",
    entityType: "semesters",
    entityId: data.id,
    details: { name, startDate, endDate, makeActive },
  });

  return NextResponse.json({ semester: data }, { status: 201 });
}
