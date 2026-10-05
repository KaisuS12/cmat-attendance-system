import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Alert, PageTitle } from "@/components/ui";
import { formatDayDate, requestTime } from "@/lib/datetime";
import { loadSemesterSummary } from "@/lib/reports";

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

  const summary = activeSemester ? await loadSemesterSummary(supabase, activeSemester, requestTime()) : [];
  const totalExpected = summary.reduce((n, e) => n + e.expected, 0);
  const totalSignedIn = summary.reduce((n, e) => n + e.signedIn, 0);
  const averageRate = totalExpected > 0 ? Math.round((totalSignedIn / totalExpected) * 100) : null;

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
            className="rounded-xl border border-slate-200 bg-white p-4 text-center transition hover:border-slate-400"
          >
            <p className="text-2xl font-semibold tabular-nums text-slate-900">{s.value}</p>
            <p className="text-xs uppercase tracking-wide text-slate-400">{s.label}</p>
          </Link>
        ))}
      </div>

      {activeSemester && (
        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-slate-900">This semester</h2>
          {summary.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No finished events yet.</p>
          ) : (
            <>
              <dl className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <dt className="text-xs text-slate-500">Events held</dt>
                  <dd className="text-2xl font-semibold text-slate-900">{summary.length}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Average attendance</dt>
                  <dd className="text-2xl font-semibold text-slate-900">{averageRate === null ? "—" : `${averageRate}%`}</dd>
                </div>
              </dl>
              <h3 className="mt-4 text-xs font-medium text-slate-500">Recent events (share of expected students who signed in)</h3>
              <ul className="mt-2 space-y-2">
                {summary.slice(0, 5).map((e) => {
                  const pct = e.expected > 0 ? Math.round((e.signedIn / e.expected) * 100) : 0;
                  return (
                    <li key={e.id}>
                      <Link href={`/officer/events/${e.id}`} className="block rounded-lg px-1 py-1 hover:bg-slate-50">
                        <div className="flex items-baseline justify-between gap-2 text-sm">
                          <span className="min-w-0 truncate font-medium text-slate-800">{e.title}</span>
                          <span className="shrink-0 text-slate-600">
                            {formatDayDate(e.lastDay, "numeric")} · <span className="font-semibold text-slate-900">{pct}%</span>
                          </span>
                        </div>
                        <div
                          className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100"
                          role="img"
                          aria-label={`${pct}% of expected students signed in`}
                          title={`${e.signedIn} of ${e.expected} expected sign-ins`}
                        >
                          <div className="h-full rounded-full bg-slate-800" style={{ width: `${pct}%` }} />
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
            className="block rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-400"
          >
            <p className="font-medium text-slate-900">{l.label}</p>
            <p className="mt-0.5 text-sm text-slate-500">{l.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
