import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { parseJsonBody } from "@/lib/validation";
import { programKey } from "@/lib/school-year";
import { loadProgramList } from "@/lib/school-year-data";

// How many years each program runs, used to decide who graduates.
export async function GET() {
  const { error } = await requireRole("admin");
  if (error) return error;
  return NextResponse.json({ programs: await loadProgramList(createAdminClient()) });
}

const bodySchema = z.object({
  programs: z
    .array(z.object({ program: z.string().trim().min(1).max(40), years: z.number().int().min(1).max(6) }))
    .min(1)
    .max(100),
});

export async function PUT(request: Request) {
  const { profile, error } = await requireRole("admin");
  if (error) return error;
  const body = await parseJsonBody(request, bodySchema);
  if (body.error) return body.error;

  const admin = createAdminClient();
  const rows = body.data.programs.map((p) => ({ program: programKey(p.program), years: p.years, updated_at: new Date().toISOString() }));
  const { error: upsertError } = await admin.from("program_settings").upsert(rows, { onConflict: "program" });
  if (upsertError) return NextResponse.json({ error: "Could not save program lengths." }, { status: 500 });

  await logAudit({
    actorId: profile.id,
    action: "program_years_updated",
    entityType: "program_settings",
    details: { programs: rows.map((r) => `${r.program}: ${r.years}`) },
  });
  return NextResponse.json({ programs: await loadProgramList(admin) });
}
