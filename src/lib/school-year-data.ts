import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { DEFAULT_PROGRAM_YEARS, planPromotion, programKey, type PromotionStudent } from "@/lib/school-year";

// Server-side loaders for the "New school year" tool (service-role client).

export async function loadProgramYears(admin: SupabaseClient): Promise<Map<string, number>> {
  const { data } = await admin.from("program_settings").select("program, years");
  return new Map((data ?? []).map((r) => [programKey(r.program), r.years as number]));
}

export async function loadCurrentStudents(admin: SupabaseClient): Promise<PromotionStudent[]> {
  return fetchAll<PromotionStudent>((from, to) =>
    admin
      .from("profiles")
      .select("id, full_name, student_id, program, year_level, graduated_at")
      .eq("role", "student")
      .is("graduated_at", null)
      .order("id")
      .range(from, to)
  );
}

export async function buildPromotionPlan(admin: SupabaseClient) {
  const [students, programYears] = await Promise.all([loadCurrentStudents(admin), loadProgramYears(admin)]);
  return planPromotion(students, programYears);
}

/** Every program seen on current students or in the settings, with its length. */
export async function loadProgramList(admin: SupabaseClient) {
  const [students, programYears] = await Promise.all([loadCurrentStudents(admin), loadProgramYears(admin)]);
  const counts = new Map<string, number>();
  for (const s of students) {
    const key = programKey(s.program);
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  for (const key of programYears.keys()) if (!counts.has(key)) counts.set(key, 0);
  return [...counts.entries()]
    .map(([program, students]) => ({ program, students, years: programYears.get(program) ?? DEFAULT_PROGRAM_YEARS }))
    .sort((a, b) => a.program.localeCompare(b.program));
}
