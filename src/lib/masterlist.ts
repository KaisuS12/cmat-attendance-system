import { isValidStudentId, normalizeStudentId } from "@/lib/constants";

// Reads a school masterlist as it's actually handed out — title rows at the
// top ("MASTER LIST", "BSTM 1", semester), a header somewhere below
// ("No | Student Name | Course"), "Male"/"Female" group rows, and course+year
// in one cell ("BSTM 1") — as well as a plain CSV with a header in row 1.
// Works on a table of cells, so CSV and Excel files share it.

export interface MasterlistRow {
  line: number;
  sheet?: string; // Excel sheet the row came from, when the file has several
  studentId: string; // "" = the system will generate one
  fullName: string;
  program: string;
  yearLevel: string;
}

export interface MasterlistIssue {
  line: number;
  text: string;
  reason: string;
}

export interface ParsedMasterlist {
  rows: MasterlistRow[];
  skipped: MasterlistIssue[];
  hasIds: boolean;
  error?: string;
}

const ALIASES = {
  studentId: ["student_id", "studentid", "student id", "id number", "id no", "id no.", "id #", "student no", "student no.", "student number", "school id", "id"],
  fullName: ["full_name", "fullname", "full name", "name", "student name", "student's name", "name of student", "names"],
  course: ["course", "course & year", "course and year", "course/year", "course & yr", "program & year", "program/year"],
  program: ["program", "degree"],
  yearLevel: ["year_level", "yearlevel", "year level", "year", "yr", "yr level", "year lvl"],
} as const;

type Col = keyof typeof ALIASES;

const norm = (s: string) => s.trim().replace(/\s+/g, " ").replace(/:$/, "").toLowerCase();

const GROUP_ROW = /^(male|female|males|females|boys?|girls?|total.*|sub-?total.*|nothing follows.*)$/i;
// "BSTM 1", "BSBA-FM 4", "BSIT 3A", "BSA-2"
const COURSE_YEAR = /^([A-Za-z][A-Za-z.&-]*(?:\s+[A-Za-z][A-Za-z.&-]*)*?)[\s-]+(\d)\s*([A-Za-z])?$/;

/** "BSTM 1" → { program: "BSTM", yearLevel: "1" }. A section letter ("BSIT 3A") is dropped. */
export function splitCourse(course: string): { program: string; yearLevel: string } {
  const c = course.trim().replace(/\s+/g, " ");
  const m = c.match(COURSE_YEAR);
  if (!m) return { program: c, yearLevel: "" };
  return { program: m[1].toUpperCase(), yearLevel: m[2] };
}

const KEEP_UPPER = /^(II|III|IV|V|VI|VII|VIII|IX|X)$/;

/** "ARINO, REYMARK LIMACO" → "Arino, Reymark Limaco" (only when the name is all caps). */
export function formatName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, " ").replace(/\s*,\s*/g, ", ");
  if (name !== name.toLocaleUpperCase()) return name; // already mixed case: keep as typed
  return name
    .split(" ")
    .map((word) => {
      const bare = word.replace(/[.,]/g, "");
      if (KEEP_UPPER.test(bare)) return word;
      return word
        .toLocaleLowerCase()
        .replace(/(^|[-'])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toLocaleUpperCase());
    })
    .join(" ");
}

function findHeader(table: string[][]): { index: number; cols: Partial<Record<Col, number>> } | null {
  const limit = Math.min(table.length, 40);
  for (let i = 0; i < limit; i++) {
    const cells = table[i].map((c) => norm(String(c ?? "")));
    const cols: Partial<Record<Col, number>> = {};
    (Object.keys(ALIASES) as Col[]).forEach((col) => {
      const idx = cells.findIndex((c) => (ALIASES[col] as readonly string[]).includes(c));
      if (idx >= 0) cols[col] = idx;
    });
    if (cols.fullName !== undefined) return { index: i, cols };
  }
  return null;
}

export function parseMasterlistTable(table: string[][], fallbackCourse = ""): ParsedMasterlist {
  const header = findHeader(table);
  if (!header) {
    return {
      rows: [],
      skipped: [],
      hasIds: false,
      error: "Couldn't find the header row. The file needs a column titled “Student Name” (or “Name” / “full_name”).",
    };
  }
  const { index, cols } = header;
  const cell = (r: string[], i: number | undefined) => (i === undefined ? "" : String(r[i] ?? "").trim());

  // Course written once above the table (e.g. a "BSTM 1" title row) is the
  // fallback for files without a Course column.
  // The sheet's name (e.g. "BSBA FM 4") is the last resort.
  let titleCourse = COURSE_YEAR.test(fallbackCourse.trim()) ? fallbackCourse.trim() : "";
  for (let i = 0; i < index; i++) {
    for (const c of table[i]) {
      const v = String(c ?? "").trim();
      if (COURSE_YEAR.test(v) && v.length <= 20) titleCourse = v;
    }
  }

  const rows: MasterlistRow[] = [];
  const skipped: MasterlistIssue[] = [];
  const seen = new Set<string>();
  let lastCourse = titleCourse;

  for (let i = index + 1; i < table.length; i++) {
    const r = table[i].map((c) => String(c ?? ""));
    const line = i + 1;
    const rawName = cell(r, cols.fullName);
    if (!rawName) continue;
    if (GROUP_ROW.test(rawName) || norm(rawName) === norm(table[index][cols.fullName!] ?? "")) continue; // group label / repeated header
    if (!/\p{L}/u.test(rawName)) continue;

    const course = cell(r, cols.course) || lastCourse;
    if (cell(r, cols.course)) lastCourse = cell(r, cols.course);
    const fromCourse = course ? splitCourse(course) : { program: "", yearLevel: "" };

    const program = (cell(r, cols.program) || fromCourse.program).toUpperCase();
    const yearLevel = cell(r, cols.yearLevel).replace(/\D+/g, "") || fromCourse.yearLevel;
    const studentId = normalizeStudentId(cell(r, cols.studentId));
    const fullName = formatName(rawName);

    if (studentId && !isValidStudentId(studentId)) {
      skipped.push({ line, text: `${studentId} ${rawName}`, reason: "Unrecognized student ID format" });
      continue;
    }

    const key = studentId ? `id:${studentId.toLowerCase()}` : `n:${fullName.toLowerCase()}|${program}|${yearLevel}`;
    if (seen.has(key)) {
      skipped.push({ line, text: rawName, reason: "Duplicate in file" });
      continue;
    }
    seen.add(key);
    rows.push({ line, studentId, fullName, program, yearLevel });
  }

  return { rows, skipped, hasIds: rows.some((r) => r.studentId !== "") };
}

export interface SheetSummary {
  name: string;
  count: number;
  program: string;
  yearLevel: string;
  error?: string;
}

// A workbook often has one sheet per class ("BSBA FM 1", "BSBA MM 1", …
// "BSBA FM 4"). Every sheet is read with its own title-row course, and the
// results are combined; the same student twice (same name, program and year,
// or same ID) is kept once.
export function parseMasterlistWorkbook(
  sheets: { name: string; table: string[][] }[]
): ParsedMasterlist & { sheets: SheetSummary[] } {
  const rows: MasterlistRow[] = [];
  const skipped: MasterlistIssue[] = [];
  const summaries: SheetSummary[] = [];
  const seen = new Set<string>();
  const multi = sheets.length > 1;

  for (const { name, table } of sheets) {
    if (table.every((r) => r.every((c) => !String(c ?? "").trim()))) continue; // empty sheet
    const parsed = parseMasterlistTable(table, name);
    if (parsed.error) {
      summaries.push({ name, count: 0, program: "", yearLevel: "", error: parsed.error });
      continue;
    }
    let count = 0;
    for (const r of parsed.rows) {
      const key = r.studentId ? `id:${r.studentId.toLowerCase()}` : `n:${r.fullName.toLowerCase()}|${r.program}|${r.yearLevel}`;
      if (seen.has(key)) {
        skipped.push({ line: r.line, text: multi ? `${name}: ${r.fullName}` : r.fullName, reason: "Duplicate in file" });
        continue;
      }
      seen.add(key);
      rows.push(multi ? { ...r, sheet: name } : r);
      count++;
    }
    skipped.push(...parsed.skipped.map((x) => (multi ? { ...x, text: `${name}: ${x.text}` } : x)));
    const first = parsed.rows[0];
    summaries.push({ name, count, program: first?.program ?? "", yearLevel: first?.yearLevel ?? "" });
  }

  const readable = summaries.filter((x) => !x.error);
  return {
    rows,
    skipped,
    hasIds: rows.some((r) => r.studentId !== ""),
    sheets: summaries,
    error: readable.length === 0 ? (summaries[0]?.error ?? "The file has no data.") : undefined,
  };
}
