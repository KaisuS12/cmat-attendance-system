import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Alert, PageTitle } from "@/components/ui";
import { formatDayDate, requestTime } from "@/lib/datetime";
import { loadSemesterAnalytics, WATCH_THRESHOLD } from "@/lib/reports";
import { TrendChart } from "@/components/charts/TrendChart";
import { GroupBars } from "@/components/charts/GroupBars";
import { MethodSplit } from "@/components/charts/MethodSplit";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const supabase = await createClient();

  const [{ count: studentCount }, { count: officerCount }, { count: eventCount }, { data: activeSemester }] =
    await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "student"),
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "officer"),
      supabase.from("events").select("*", { count: "exact", head: true }),
      supabase.from("semesters").select("id, name, is_active").eq("is_active", true).maybeSingle(),
    ]);

  const analytics = activeSemester ? await loadSemesterAnalytics(supabase, activeSemester, requestTime()) : null;
  const pct = (r: number) => `${Math.round(r * 100)}%`;

  const stats = [
    { label: "Students", value: studentCount ?? 0, href: "/admin/students" },
    { label: "Officers", value: officerCount ?? 0, href: "/admin/officers" },
    { label: "Events", value: eventCount ?? 0, href: "/officer" },
  ];

  const links = [
    { href: "/officer", label: "Events", desc: "Create events, open the scanner, export attendance" },
    { href: "/admin/students", label: "Students", desc: "Search students, view records, reset passwords" },
    { href: "/admin/students/import", label: "Import masterlist", desc: "Create student accounts from a CSV" },
    { href: "/admin/officers", label: "Officer accounts", desc: "Add, reset or deactivate officers" },
    { href: "/admin/semesters", label: "Semesters", desc: "Set the active semester, export clearance sheets" },
    { href: "/admin/audit-log", label: "Audit log", desc: "Who did what, and when" },
  ];

  return (
    <div>
      <PageTitle title="Admin dashboard" subtitle={activeSemester ? `Current semester: ${activeSemester.name}` : undefined} />

      {!activeSemester && (
        <div className="mt-4">
          <Alert kind="info">
            No active semester yet. <Link href="/admin/semesters" className="font-medium underline">Create one</Link>{" "}
            so new events and clearance exports are grouped by semester.
          </Alert>
        </div>
      )}

      <div className="mt-6 grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="rounded-xl border border-slate-200 border-t-4 border-t-gold-400 bg-white p-4 text-center shadow-sm transition hover:border-gold-400"
          >
            <p className="text-2xl font-bold text-brand-800">{s.value}</p>
            <p className="text-xs font-semibold uppercase tracking-wide text-gold-600">{s.label}</p>
          </Link>
        ))}
      </div>

      {activeSemester && (
        <section className="mt-6 rounded-xl border border-slate-200 border-l-4 border-l-gold-400 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-brand-800">
            <span className="h-2 w-2 rounded-full bg-gold-400" aria-hidden="true" />
            This semester
          </h2>
          {!analytics || analytics.eventsHeld === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No finished events yet. Analytics appear after the first event.</p>
          ) : (
            <>
              {/* KPI row */}
              <dl className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div className="rounded-lg bg-brand-50 p-3">
                  <dt className="text-xs text-slate-600">Events held</dt>
                  <dd className="text-2xl font-bold text-brand-800">{analytics.eventsHeld}</dd>
                </div>
                <div className="rounded-lg bg-gold-100 p-3 ring-1 ring-inset ring-gold-400/60">
                  <dt className="text-xs text-slate-600">Average attendance</dt>
                  <dd className="text-2xl font-bold text-gold-600">
                    {analytics.averageRate === null ? "—" : pct(analytics.averageRate)}
                  </dd>
                </div>
                <div className="rounded-lg bg-brand-50 p-3">
                  <dt className="text-xs text-slate-600">Total check-ins</dt>
                  <dd className="text-2xl font-bold text-brand-800">{analytics.totalCheckIns}</dd>
                </div>
                <div className="rounded-lg bg-red-50 p-3 ring-1 ring-inset ring-red-200">
                  <dt className="text-xs text-slate-600">Students to watch</dt>
                  <dd className="text-2xl font-bold text-red-700">{analytics.watchCount}</dd>
                </div>
              </dl>

              {/* Trend */}
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-brand-800">Attendance trend</h3>
                <p className="text-xs text-slate-500">Share of expected students who signed in, per event day</p>
                <div className="mt-2">
                  <TrendChart
                    data={analytics.trend.map((t) => ({
                      key: t.dayId,
                      title: t.title,
                      date: t.date,
                      signedIn: t.signedIn,
                      expected: t.expected,
                      rate: t.rate,
                    }))}
                  />
                </div>
                <details className="mt-1 text-xs text-slate-500">
                  <summary className="cursor-pointer">Show data</summary>
                  <table className="mt-2 w-full text-left">
                    <thead>
                      <tr className="text-slate-400">
                        <th className="py-1 font-medium">Event</th>
                        <th className="py-1 font-medium">Day</th>
                        <th className="py-1 text-right font-medium">Signed in</th>
                        <th className="py-1 text-right font-medium">Rate</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-700">
                      {analytics.trend.map((t) => (
                        <tr key={t.dayId}>
                          <td className="py-0.5">{t.title}</td>
                          <td className="py-0.5">{formatDayDate(t.date, "numeric")}</td>
                          <td className="py-0.5 text-right">
                            {t.signedIn} / {t.expected}
                          </td>
                          <td className="py-0.5 text-right font-semibold">{pct(t.rate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              </div>

              {/* Groups + method split */}
              <div className="mt-6 grid gap-6 md:grid-cols-3">
                <div>
                  <h3 className="text-sm font-semibold text-brand-800">By program</h3>
                  <div className="mt-3">
                    <GroupBars title="Attendance by program" data={analytics.byProgram} />
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-brand-800">By year level</h3>
                  <div className="mt-3">
                    <GroupBars title="Attendance by year level" data={analytics.byYear} />
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-brand-800">How students signed in</h3>
                  <div className="mt-3">
                    <MethodSplit qr={analytics.methods.qr} manual={analytics.methods.manual} />
                  </div>
                </div>
              </div>

              {/* Watch list */}
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-brand-800">Students to watch</h3>
                <p className="text-xs text-slate-500">
                  Attended less than {Math.round(WATCH_THRESHOLD * 100)}% of the event days meant for them (signed in
                  and out), counting finished days only
                </p>
                {analytics.watchList.length === 0 ? (
                  <p className="mt-2 text-sm text-emerald-700">Everyone is on track. 🎉</p>
                ) : (
                  <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-sm">
                      <thead className="bg-gold-100 text-left text-xs uppercase tracking-wide text-gold-600">
                        <tr>
                          <th className="px-3 py-2">Student</th>
                          <th className="hidden px-3 py-2 sm:table-cell">Section</th>
                          <th className="px-3 py-2 text-right">Attended</th>
                          <th className="px-3 py-2 text-right">Rate</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {analytics.watchList.map((w) => (
                          <tr key={w.student.id} className="hover:bg-gold-100/40">
                            <td className="px-3 py-2">
                              <Link href={`/admin/students/${w.student.id}`} className="font-medium text-slate-800 hover:underline">
                                {w.student.full_name}
                              </Link>
                              <span className="block text-xs text-slate-500">{w.student.student_id}</span>
                            </td>
                            <td className="hidden px-3 py-2 text-slate-600 sm:table-cell">
                              {[w.student.program, [w.student.year_level, w.student.section].filter(Boolean).join("-")]
                                .filter(Boolean)
                                .join(" ")}
                            </td>
                            <td className="px-3 py-2 text-right text-slate-700">
                              {w.attended} / {w.required}
                            </td>
                            <td className="px-3 py-2 text-right font-semibold text-red-700">{pct(w.rate)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {analytics.watchCount > analytics.watchList.length && (
                      <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
                        Showing the {analytics.watchList.length} lowest of {analytics.watchCount}. Export the clearance
                        CSV from Semesters for the full list.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Recent events */}
              <h3 className="mt-6 text-sm font-semibold text-brand-800">Recent events</h3>
              <ul className="mt-2 space-y-2">
                {analytics.recent.slice(0, 5).map((e) => {
                  const rate = e.expected > 0 ? Math.round((e.signedIn / e.expected) * 100) : 0;
                  return (
                    <li key={e.id}>
                      <Link href={`/officer/events/${e.id}`} className="block rounded-lg px-1 py-1 hover:bg-gold-100/60">
                        <div className="flex items-baseline justify-between gap-2 text-sm">
                          <span className="min-w-0 truncate font-medium text-slate-800">{e.title}</span>
                          <span className="shrink-0 text-slate-600">
                            {formatDayDate(e.lastDay, "numeric")} · <span className="font-semibold text-brand-800">{rate}%</span>
                          </span>
                        </div>
                        <div
                          className="mt-1 h-2 overflow-hidden rounded-full bg-brand-50"
                          role="img"
                          aria-label={`${rate}% of expected students signed in`}
                          title={`${e.signedIn} of ${e.expected} expected sign-ins`}
                        >
                          <div className="h-full rounded-full bg-brand-600" style={{ width: `${rate}%` }} />
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="group block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-gold-400 hover:bg-gold-100/40"
          >
            <p className="flex items-center justify-between font-semibold text-brand-800">
              {l.label}
              <span className="text-gold-500 transition group-hover:translate-x-0.5" aria-hidden="true">→</span>
            </p>
            <p className="mt-0.5 text-sm text-slate-500">{l.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
