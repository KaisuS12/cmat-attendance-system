// Which students an event is meant for. An event with no target programs
// and no target year levels is for everyone. Matching ignores case and extra
// whitespace, since masterlist values like "BSIT" / "bsit " vary by export.

export interface EventTargets {
  target_programs: string[] | null;
  target_year_levels: string[] | null;
}

export interface StudentGroup {
  program: string | null;
  year_level: string | null;
}

export function normalizeGroupValue(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function matches(targets: string[] | null, value: string | null): boolean {
  if (!targets || targets.length === 0) return true;
  const v = normalizeGroupValue(value);
  return targets.some((t) => normalizeGroupValue(t) === v);
}

export function isEventForStudent(event: EventTargets, student: StudentGroup): boolean {
  return matches(event.target_programs, student.program) && matches(event.target_year_levels, student.year_level);
}

export function isTargeted(event: EventTargets): boolean {
  return (event.target_programs?.length ?? 0) > 0 || (event.target_year_levels?.length ?? 0) > 0;
}

function yearLabel(y: string): string {
  return /^\d+$/.test(y.trim()) ? `Year ${y.trim()}` : y.trim();
}

/** e.g. "BSIT, BSA · Year 3, Year 4" — or "All students". */
export function describeTargets(event: EventTargets): string {
  if (!isTargeted(event)) return "All students";
  const parts: string[] = [];
  if (event.target_programs?.length) parts.push(event.target_programs.join(", "));
  if (event.target_year_levels?.length) parts.push(event.target_year_levels.map(yearLabel).join(", "));
  return parts.join(" · ");
}

/** Trims, drops blanks and case-insensitive duplicates; returns null for "everyone". */
export function cleanTargets(values: string[] | undefined | null): string[] | null {
  if (!values) return null;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const trimmed = v.trim().replace(/\s+/g, " ");
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out.length > 0 ? out : null;
}
