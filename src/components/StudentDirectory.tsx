import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AccountActions } from "@/components/AccountActions";
import { TempPasswordReveal } from "@/components/TempPasswordReveal";
import { LiveSearch } from "@/components/LiveSearch";
import { Badge, btnSecondary, EmptyState } from "@/components/ui";
import type { Profile } from "@/types/database";

const PAGE_SIZE = 50;

function groupLabel(s: Profile) {
  return [s.program, [s.year_level, s.section].filter(Boolean).join("-")].filter(Boolean).join(" ");
}

// Searchable, paginated student list. Admins link through to each student's
// record and edit page; officers get an inline "Reset password" instead.
export async function StudentDirectory({
  basePath,
  q,
  page,
  mode,
}: {
  basePath: string;
  q: string;
  page: number;
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
      `student_id.ilike.%${term}%,full_name.ilike.%${term}%,program.ilike.%${term}%,section.ilike.%${term}%`
    );

  const { data, count } = await query;
  const students = (data ?? []) as Profile[];
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const pageHref = (p: number) => `${basePath}?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`;

  const actions = (s: Profile) =>
    mode === "officer" ? (
      <AccountActions
        userId={s.id}
        name={s.full_name}
        isActive={s.is_active}
        canDeactivate={false}
        slip={{ studentId: s.student_id ?? "", program: s.program, yearLevel: s.year_level, section: s.section }}
      />
    ) : (
      <Link href={`/admin/students/${s.id}`} className="inline-flex min-h-9 items-center text-sm text-slate-500 hover:text-slate-900">
        View →
      </Link>
    );

  return (
    <div>
      <p className="text-sm text-slate-500">
        {count ?? 0} {q ? "matching" : "total"}
      </p>

      <LiveSearch initialQuery={q} placeholder="Search by name, student ID, program or section" />

      <div className="mt-4">
        {students.length === 0 ? (
          <EmptyState>{q ? "No students match your search." : "No students yet."}</EmptyState>
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
                    <th className="px-4 py-2">Program / Section</th>
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
  const page = Math.max(1, Number(typeof params.page === "string" ? params.page : 1) || 1);
  return { q, page };
}
