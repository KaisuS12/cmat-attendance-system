import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/SignOutButton";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const supabase = await createClient();

  const [{ count: studentCount }, { count: officerCount }, { count: eventCount }] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "student"),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "officer"),
    supabase.from("events").select("*", { count: "exact", head: true }),
  ]);

  const stats = [
    { label: "Students", value: studentCount ?? 0 },
    { label: "Officers", value: officerCount ?? 0 },
    { label: "Events", value: eventCount ?? 0 },
  ];

  const links = [
    { href: "/officer", label: "Events (create & manage)" },
    { href: "/admin/officers", label: "Officer accounts" },
    { href: "/admin/semesters", label: "Semesters" },
    { href: "/admin/audit-log", label: "Audit log" },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Admin Dashboard</h1>
        <SignOutButton />
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-4 text-center">
            <p className="text-2xl font-semibold text-slate-900">{s.value}</p>
            <p className="text-xs uppercase tracking-wide text-slate-400">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 space-y-2">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="block rounded-xl border border-slate-200 bg-white p-4 font-medium text-slate-700 hover:border-slate-300"
          >
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
