// Moving students up a year at the start of a school year. Pure, so the
// preview and the real run (which recomputes server-side) always agree.

export const DEFAULT_PROGRAM_YEARS = 4;

export interface PromotionStudent {
  id: string;
  full_name: string;
  student_id: string | null;
  program: string | null;
  year_level: string | null;
  graduated_at: string | null;
}

export interface PromotionChange {
  id: string;
  from: string | null;
  to_year: string | null; // null when graduating (year stays as the last one)
  graduated: boolean;
}

export interface ProgramSummary {
  program: string;
  years: number;
  promoted: number;
  graduating: number;
}

export interface PromotionPlan {
  changes: PromotionChange[];
  promoted: number;
  graduating: number;
  skipped: { id: string; name: string; studentId: string | null; program: string | null; yearLevel: string | null }[];
  byProgram: ProgramSummary[];
}

/** "  bsTM " → "BSTM": programs match regardless of case and spacing. */
export function programKey(program: string | null | undefined): string {
  return (program ?? "").trim().replace(/\s+/g, " ").toUpperCase();
}

export function yearsFor(program: string | null, programYears: Map<string, number>): number {
  return programYears.get(programKey(program)) ?? DEFAULT_PROGRAM_YEARS;
}

export function planPromotion(students: PromotionStudent[], programYears: Map<string, number>): PromotionPlan {
  const changes: PromotionChange[] = [];
  const skipped: PromotionPlan["skipped"] = [];
  const byProgram = new Map<string, ProgramSummary>();

  for (const s of students) {
    if (s.graduated_at) continue;
    const year = (s.year_level ?? "").trim();
    if (!/^\d+$/.test(year)) {
      skipped.push({ id: s.id, name: s.full_name, studentId: s.student_id, program: s.program, yearLevel: s.year_level });
      continue;
    }
    const key = programKey(s.program) || "Unassigned";
    const years = yearsFor(s.program, programYears);
    const summary = byProgram.get(key) ?? { program: key, years, promoted: 0, graduating: 0 };
    const n = Number(year);
    if (n >= years) {
      changes.push({ id: s.id, from: s.year_level, to_year: null, graduated: true });
      summary.graduating++;
    } else {
      changes.push({ id: s.id, from: s.year_level, to_year: String(n + 1), graduated: false });
      summary.promoted++;
    }
    byProgram.set(key, summary);
  }

  return {
    changes,
    promoted: changes.filter((c) => !c.graduated).length,
    graduating: changes.filter((c) => c.graduated).length,
    skipped,
    byProgram: [...byProgram.values()].sort((a, b) => a.program.localeCompare(b.program)),
  };
}
