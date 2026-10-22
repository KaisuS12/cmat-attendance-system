import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { parseJsonBody } from "@/lib/validation";
import { buildPromotionPlan } from "@/lib/school-year-data";

// GET: preview what "New school year" would do. POST: do it.
export async function GET() {
  const { error } = await requireRole("admin");
  if (error) return error;
  const plan = await buildPromotionPlan(createAdminClient());
  return NextResponse.json({
    promoted: plan.promoted,
    graduating: plan.graduating,
    skipped: plan.skipped,
    byProgram: plan.byProgram,
  });
}

const bodySchema = z.object({
  // What the admin saw in the preview; if the numbers changed since, they
  // must look again rather than promote something different.
  expected: z.object({ promoted: z.number().int(), graduating: z.number().int() }),
  // The last semester of the school year that's ending: its class list (and
  // earlier ones) is frozen so old reports don't change.
  lastSemesterId: z.string().uuid().nullable(),
});

export async function POST(request: Request) {
  const { profile, error } = await requireRole("admin");
  if (error) return error;
  const body = await parseJsonBody(request, bodySchema);
  if (body.error) return body.error;

  const admin = createAdminClient();
  // Recomputed here: the server never applies a list sent by the browser.
  const plan = await buildPromotionPlan(admin);
  if (plan.changes.length === 0) {
    return NextResponse.json({ error: "There are no students to move up." }, { status: 409 });
  }
  if (plan.promoted !== body.data.expected.promoted || plan.graduating !== body.data.expected.graduating) {
    return NextResponse.json(
      { error: "Student records changed since the preview. Preview again, then confirm." },
      { status: 409 }
    );
  }

  const { data: promotionId, error: rpcError } = await admin.rpc("apply_school_year", {
    p_actor: profile.id,
    p_changes: plan.changes,
    p_last_semester: body.data.lastSemesterId,
  });
  if (rpcError) {
    return NextResponse.json({ error: "Could not move students up. Nothing was changed." }, { status: 500 });
  }

  await logAudit({
    actorId: profile.id,
    action: "school_year_promoted",
    entityType: "year_promotions",
    entityId: promotionId as string,
    details: { promoted: plan.promoted, graduating: plan.graduating, skipped: plan.skipped.length },
  });
  return NextResponse.json({ id: promotionId, promoted: plan.promoted, graduating: plan.graduating });
}
