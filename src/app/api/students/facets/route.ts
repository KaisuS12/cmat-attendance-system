import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { normalizeGroupValue } from "@/lib/eligibility";

// Distinct programs and year levels among students, for the event
// "who should attend" picker. Values come from the imported masterlist, so
// what officers can pick always matches what students actually have.
export async function GET() {
  const { error } = await requireRole("officer", "admin");
  if (error) return error;

  const admin = createAdminClient();
  let rows: { program: string | null; year_level: string | null }[];
  try {
    rows = await fetchAll((from, to) =>
      admin
        .from("profiles")
        .select("program, year_level")
        .eq("role", "student")
        .order("id")
        .range(from, to)
    );
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  const distinct = (values: (string | null)[]) => {
    const byKey = new Map<string, string>();
    for (const v of values) {
      const key = normalizeGroupValue(v);
      if (key && !byKey.has(key)) byKey.set(key, v!.trim());
    }
    return [...byKey.values()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  };

  return NextResponse.json({
    programs: distinct(rows.map((r) => r.program)),
    yearLevels: distinct(rows.map((r) => r.year_level)),
  });
}
