import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Alert, PageTitle } from "@/components/ui";
import { formatDayDate, requestTime } from "@/lib/datetime";
import { loadSemesterAnalytics, WATCH_THRESHOLD } from "@/lib/reports";
import { EventColumns } from "@/components/charts/EventColumns";
import { AttendanceGauge } from "@/components/charts/AttendanceGauge";
import { WaveChart } from "@/components/charts/WaveChart";
import { EventCalendar } from "@/components/charts/EventCalendar";
import { GroupBars } from "@/components/charts/GroupBars";
import { MethodSplit } from "@/components/charts/MethodSplit";
import { SERIES_BLUE, SERIES_GOLD } from "@/components/charts/colors";

export const dynamic = "force-dynamic";

const card = "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5";
const goldButton =
  "inline-flex items-center rounded-md bg-gold-400 px-3 py-1.5 text-xs font-semibold text-brand-800 shadow-sm transition hover:bg-gold-300";

function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div>
        <h2 className="font-semibold text-brand-800">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

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

  const recentDays = analytics?.trend.slice(-8) ?? [];

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

      {analytics && activeSemester && (
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {/* Row 1: columns + gauge */}
          <section className={`${card} md:col-span-2`}>
            <CardHeader
              title="Event attendance"
              subtitle="Last 8 event days · signed in vs completed (signed in and out)"
              action={
                <Link href="/officer" className={goldButton}>
                  All events
                </Link>
              }
            />
            <div className="mb-2 flex flex-wrap gap-4 text-xs text-slate-600">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: SERIES_BLUE }} aria-hidden="true" />
                Signed in
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: SERIES_GOLD }} aria-hidden="true" />
                Completed
              </span>
            </div>
            <EventColumns
              data={recentDays.map((t) => ({
                key: t.dayId,
                title: t.title,
                date: t.date,
                signedIn: t.signedIn,
                complete: t.complete,
                expected: t.expected,
              }))}
            />
            {recentDays.length > 0 && (
              <details className="mt-1 text-xs text-slate-500">
                <summary className="cursor-pointer">Show data</summary>
                <table className="mt-2 w-full text-left">
                  <thead>
                    <tr className="text-slate-400">
                      <th className="py-1 font-medium">Event</th>
                      <th className="py-1 font-medium">Day</th>
                      <th className="py-1 text-right font-medium">Signed in</th>
                      <th className="py-1 text-right font-medium">Completed</th>
                      <th className="py-1 text-right font-medium">Expected</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-700">
                    {analytics.trend.map((t) => (
                      <tr key={t.dayId}>
                        <td className="py-0.5">{t.title}</td>
                        <td className="py-0.5">{formatDayDate(t.date, "numeric")}</td>
                        <td className="py-0.5 text-right">{t.signedIn}</td>
                        <td className="py-0.5 text-right">{t.complete}</td>
                        <td className="py-0.5 text-right">{t.expected}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            )}
          </section>

          <section className={`${card} flex flex-col`}>
            <AttendanceGauge rate={analytics.averageRate} label="average attendance" />
            <ul className="mt-4 divide-y divide-slate-100 text-sm">
              {[
                { label: "Events held", value: analytics.eventsHeld, dot: "bg-brand-600" },
                { label: "Total check-ins", value: analytics.totalCheckIns, dot: "bg-brand-600" },
                { label: "Manual entries", value: analytics.methods.manual, dot: "bg-gold-500" },
                { label: "Students to watch", value: analytics.watchCount, dot: "bg-red-500" },
              ].map((row) => (
                <li key={row.label} className="flex items-center justify-between py-2">
                  <span className="flex items-center gap-2 text-slate-600">
                    <span className={`h-2 w-2 rounded-full ${row.dot}`} aria-hidden="true" />
                    {row.label}
                  </span>
                  <span className="font-semibold text-slate-900">{row.value}</span>
                </li>
              ))}
            </ul>
            <a href={`/api/semesters/${activeSemester.id}/export`} className={`${goldButton} mt-auto justify-center py-2`}>
              Download clearance CSV
            </a>
          </section>

          {/* Row 2: waves + calendar */}
          <section className={`${card} md:col-span-2`}>
            <CardHeader title="Attendance trend" subtitle="Share of expected students, per event day" />
            <WaveChart
              data={analytics.trend.map((t) => ({
                key: t.dayId,
                title: t.title,
                date: t.date,
                rate: t.rate,
                completeRate: t.completeRate,
              }))}
            />
          </section>

          <section className={card}>
            <CardHeader title="Event calendar" />
            <EventCalendar items={analytics.calendar} />
          </section>

          {/* Row 3: breakdowns */}
          <section className={card}>
            <CardHeader title="By program" />
            <GroupBars title="Attendance by program" data={analytics.byProgram} />
          </section>
          <section className={card}>
            <CardHeader title="By year level" />
            <GroupBars title="Attendance by year level" data={analytics.byYear} />
          </section>
          <section className={card}>
            <CardHeader title="How students signed in" />
            <MethodSplit qr={analytics.methods.qr} manual={analytics.methods.manual} />
          </section>

          {/* Row 4: watch list */}
          <section className={`${card} md:col-span-3`}>
            <CardHeader
              title="Students to watch"
              subtitle={`Attended less than ${Math.round(WATCH_THRESHOLD * 100)}% of the event days meant for them (signed in and out), finished days only`}
            />
            {analytics.watchList.length === 0 ? (
              <p className="text-sm text-emerald-700">
                {analytics.eventsHeld === 0 ? "Appears after the first finished event." : "Everyone is on track. 🎉"}
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
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
                    Showing the {analytics.watchList.length} lowest of {analytics.watchCount}. Download the clearance CSV
                    for the full list.
                  </p>
                )}
              </div>
            )}
          </section>
        </div>
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
