import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AccountActions } from "@/components/AccountActions";
import { TempPasswordReveal } from "@/components/TempPasswordReveal";
import { LiveSearch } from "@/components/LiveSearch";
import { CourseFilter, type CourseCount } from "@/components/CourseFilter";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { Badge, btnSecondary, EmptyState } from "@/components/ui";
import type { Profile } from "@/types/database";

const PAGE_SIZE = 50;

// Course buttons: every program on current (not graduated) students, with
// counts per year. Computed from the data, so a newly imported course
// appears by itself.
async function loadCourseCounts(supabase: Awaited<ReturnType<typeof createClient>>): Promise<{ courses: CourseCount[]; total: number }> {
  try {
    const rows = await fetchAll<{ program: string | null; year_level: string | null }>((from, to) =>
      supabase
        .from("profiles")
        .select("program, year_level")
        .eq("role", "student")
        .is("graduated_at", null)
        .order("id")
        .range(from, to)
    );
    const byProgram = new Map<string, Map<string, number>>();
    for (const r of rows) {
      const program = (r.program ?? "").trim().replace(/\s+/g, " ").toUpperCase();
      if (!program) continue;
      const years = byProgram.get(program) ?? new Map<string, number>();
      const year = (r.year_level ?? "").trim();
      if (year) years.set(year, (years.get(year) ?? 0) + 1);
      byProgram.set(program, years);
    }
    const courses = [...byProgram.entries()]
      .map(([program, years]) => ({
        program,
        count: rows.filter((r) => (r.program ?? "").trim().replace(/\s+/g, " ").toUpperCase() === program).length,
        years: [...years.entries()]
          .map(([year, count]) => ({ year, count }))
          .sort((a, b) => a.year.localeCompare(b.year, undefined, { numeric: true })),
      }))
      .sort((a, b) => a.program.localeCompare(b.program));
    return { courses, total: rows.length };
  } catch {
    return { courses: [], total: 0 };
  }
}

// ilike without wildcards: an exact, case-insensitive match.
const exactIlike = (v: string) => v.replace(/[\\%_]/g, (c) => `\\${c}`);

function groupLabel(s: Profile) {
  return [s.program, s.year_level].filter(Boolean).join(" ");
}

// Searchable, paginated student list. Admins link through to each student's
// record and edit page; officers get an inline "Reset password" instead.
export async function StudentDirectory({
  basePath,
  q,
  page,
  program = "",
  year = "",
  mode,
}: {
  basePath: string;
  q: string;
  page: number;
  program?: string;
  year?: string;
  mode: "admin" | "officer";
}) {
  const supabase = await createClient();
  let query = supabase
    .from("profiles")
    .select("*", { count: "exact" })
    .eq("role", "student")
    .order("full_name")
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  // Strip characters that have meaning inside a PostgREST or() filter.
  const term = q.replace(/[,()*%\\:"]/g, " ").trim();
  if (term) query = query.or(
      `student_id.ilike.%${term}%,full_name.ilike.%${term}%,program.ilike.%${term}%`
    );

  if (program) query = query.ilike("program", exactIlike(program));
  if (program && year) query = query.eq("year_level", year);

  const [{ data, count }, { courses, total }] = await Promise.all([query, loadCourseCounts(supabase)]);
  const students = (data ?? []) as Profile[];
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const pageHref = (p: number) =>
    `${basePath}?${new URLSearchParams({
      ...(q ? { q } : {}),
      ...(program ? { program } : {}),
      ...(program && year ? { year } : {}),
      page: String(p),
    })}`;
  const filtered = [program, program && year ? `year ${year}` : ""].filter(Boolean).join(" · ");

  const actions = (s: Profile) =>
    mode === "officer" ? (
      <AccountActions
        userId={s.id}
        name={s.full_name}
        isActive={s.is_active}
        canDeactivate={false}
        slip={{ studentId: s.student_id ?? "", program: s.program, yearLevel: s.year_level }}
      />
    ) : (
      <Link href={`/admin/students/${s.id}`} className="inline-flex min-h-9 items-center text-sm text-slate-500 hover:text-slate-900">
        View →
      </Link>
    );

  return (
    <div>
      <p className="text-sm text-slate-500">
        {count ?? 0} {q ? "matching" : filtered ? `in ${filtered}` : "total"}
      </p>

      <CourseFilter basePath={basePath} q={q} program={program} year={year} courses={courses} total={total} />

      <LiveSearch initialQuery={q} placeholder="Search by name, student ID or program" />

      <div className="mt-4">
        {students.length === 0 ? (
          <EmptyState>{q || program ? "No students match." : "No students yet."}</EmptyState>
        ) : (
          <>
            {/* Phones: cards */}
            <ul className="space-y-2 sm:hidden">
              {students.map((s) => (
                <li key={s.id} className="rounded-xl border border-slate-200 border-l-4 border-l-gold-400 bg-white p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900">
                        {mode === "admin" ? (
                          <Link href={`/admin/students/${s.id}`}>{s.full_name}</Link>
                        ) : (
                          s.full_name
                        )}
                      </p>
                      <p className="text-sm text-slate-500">
                        {s.student_id} · {groupLabel(s) || "—"}
                      </p>
                      <div className="mt-1.5">
                        <TempPasswordReveal studentId={s.id} hasTempPassword={s.must_change_password === true} />
                      </div>
                    </div>
                    {!s.is_active && <Badge tone="red">Deactivated</Badge>}
                    {s.graduated_at && <Badge tone="gold">Graduated</Badge>}
                  </div>
                  <div className="mt-2 flex justify-end">{actions(s)}</div>
                </li>
              ))}
            </ul>

            {/* Wider screens: table */}
            <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white sm:block">
              <table className="w-full text-sm">
                <thead className="bg-gold-100 text-left text-xs uppercase tracking-wide text-gold-600">
                  <tr>
                    <th className="px-4 py-2">Name</th>
                    <th className="px-4 py-2">Student ID</th>
                    <th className="px-4 py-2">Program / Year</th>
                    <th className="px-4 py-2">Temporary password</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 align-top">
                  {students.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-medium text-slate-800">
                        {mode === "admin" ? (
                          <Link href={`/admin/students/${s.id}`} className="hover:underline">
                            {s.full_name}
                          </Link>
                        ) : (
                          s.full_name
                        )}
                        {!s.is_active && (
                          <span className="ml-2">
                            <Badge tone="red">Deactivated</Badge>
                          </span>
                        )}
                        {s.graduated_at && (
                          <span className="ml-2">
                            <Badge tone="gold">Graduated</Badge>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{s.student_id}</td>
                      <td className="px-4 py-2.5 text-slate-600">{groupLabel(s)}</td>
                      <td className="px-4 py-2.5">
                        <TempPasswordReveal studentId={s.id} hasTempPassword={s.must_change_password === true} />
                      </td>
                      <td className="px-4 py-2.5 text-right">{actions(s)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className={btnSecondary}>
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-slate-500">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={pageHref(page + 1)} className={btnSecondary}>
              Next →
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}

export function parseDirectoryParams(params: Record<string, string | string[] | undefined>) {
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const program = typeof params.program === "string" ? params.program.trim().slice(0, 40) : "";
  const year = typeof params.year === "string" ? params.year.trim().slice(0, 10) : "";
  const page = Math.max(1, Number(typeof params.page === "string" ? params.page : 1) || 1);
  return { q, page, program, year };
}
