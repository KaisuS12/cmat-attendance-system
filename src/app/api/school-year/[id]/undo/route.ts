import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

// Puts a promotion back the way it was (allowed for 24 hours).
export async function POST(_request: Request, { params }: RouteContext<"/api/school-year/[id]/undo">) {
  const { profile, error } = await requireRole("admin");
  if (error) return error;
  const { id } = await params;

  const admin = createAdminClient();
  const { data: restored, error: rpcError } = await admin.rpc("undo_school_year", { p_id: id });
  if (rpcError) {
    return NextResponse.json(
      { error: "This can't be undone anymore (already undone, or more than 24 hours ago)." },
      { status: 409 }
    );
  }

  await logAudit({
    actorId: profile.id,
    action: "school_year_undone",
    entityType: "year_promotions",
    entityId: id,
    details: { restored },
  });
  return NextResponse.json({ restored });
}
