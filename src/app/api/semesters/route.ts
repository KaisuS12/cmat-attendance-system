import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { parseJsonBody } from "@/lib/validation";

export async function GET() {
  const { error } = await requireRole();
  if (error) return error;

  const admin = createAdminClient();
  const { data, error: queryError } = await admin
    .from("semesters")
    .select("*")
    .order("start_date", { ascending: false });

  if (queryError) return NextResponse.json({ error: queryError.message }, { status: 500 });
  return NextResponse.json({ semesters: data });
}

const bodySchema = z
  .object({
    name: z.string().trim().min(1, "Name is required."),
    startDate: z.iso.date(),
    endDate: z.iso.date(),
    makeActive: z.boolean().default(false),
  })
  .refine((b) => b.endDate > b.startDate, { path: ["endDate"], message: "End date must be after the start date." });

export async function POST(request: Request) {
  const { profile, error } = await requireRole("admin");
  if (error) return error;

  const body = await parseJsonBody(request, bodySchema);
  if (body.error) return body.error;
  const { name, startDate, endDate, makeActive } = body.data;

  const admin = createAdminClient();

  const { data, error: insertError } = await admin
    .from("semesters")
    .insert({ name, start_date: startDate, end_date: endDate, is_active: false })
    .select("*")
    .single();

  if (insertError || !data) {
    return NextResponse.json({ error: "Could not create semester." }, { status: 500 });
  }

  if (makeActive) {
    const { error: activateError } = await admin.rpc("set_active_semester", { p_id: data.id });
    if (activateError) {
      return NextResponse.json(
        { error: "Semester created, but it couldn't be set active. Try “Set active” again." },
        { status: 500 }
      );
    }
  }

  await logAudit({
    actorId: profile.id,
    action: "semester_created",
    entityType: "semesters",
    entityId: data.id,
    details: { name, startDate, endDate, makeActive },
  });

  return NextResponse.json({ semester: { ...data, is_active: makeActive } }, { status: 201 });
}
