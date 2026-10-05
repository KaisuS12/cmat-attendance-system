import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge, btnPrimary, btnSecondary, EmptyState, inputClass, PageTitle } from "@/components/ui";
import type { Profile } from "@/types/database";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function StudentsPage({ searchParams }: PageProps<"/admin/students">) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const page = Math.max(1, Number(typeof params.page === "string" ? params.page : 1) || 1);

  const supabase = await createClient();
  let query = supabase
    .from("profiles")
    .select("*", { count: "exact" })
    .eq("role", "student")
    .order("full_name")
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const term = q.replace(/[,()*%\\:"]/g, " ").trim();
  if (term) query = query.or(`student_id.ilike.%${term}%,full_name.ilike.%${term}%,section.ilike.%${term}%`);

  const { data, count } = await query;
  const students = (data ?? []) as Profile[];
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const pageHref = (p: number) => `/admin/students?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`;

  return (
    <div>
      <PageTitle
        title="Students"
        subtitle={`${count ?? 0} ${q ? "matching" : "total"}`}
        actions={
          <Link href="/admin/students/import" className={btnPrimary}>
            Import masterlist
          </Link>
        }
      />

      <form className="mt-6 flex gap-2" action="/admin/students">
        <input name="q" defaultValue={q} placeholder="Search by student ID, name or section" className={inputClass} />
        <button type="submit" className={btnSecondary}>
          Search
        </button>
      </form>

      <div className="mt-4">
        {students.length === 0 ? (
          <EmptyState>
            {q ? "No students match your search." : "No students yet. Import the masterlist to create accounts."}
          </EmptyState>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[36rem] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Student ID</th>
                  <th className="px-4 py-2">Program</th>
                  <th className="px-4 py-2">Year / Section</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-medium text-slate-800">
                      <Link href={`/admin/students/${s.id}`} className="hover:underline">
                        {s.full_name}
                      </Link>
                      {!s.is_active && (
                        <span className="ml-2">
                          <Badge tone="red">Deactivated</Badge>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{s.student_id}</td>
                    <td className="px-4 py-2.5 text-slate-600">{s.program}</td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {[s.year_level, s.section].filter(Boolean).join(" / ")}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link href={`/admin/students/${s.id}`} className="text-sm text-slate-500 hover:text-slate-900">
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
