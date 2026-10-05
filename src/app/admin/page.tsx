import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Alert, PageTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const supabase = await createClient();

  const [{ count: studentCount }, { count: officerCount }, { count: eventCount }, { data: activeSemester }] =
    await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "student"),
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "officer"),
      supabase.from("events").select("*", { count: "exact", head: true }),
      supabase.from("semesters").select("id, name").eq("is_active", true).maybeSingle(),
    ]);

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
