import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AuditLogPage() {
  const supabase = await createClient();
  const { data: entries } = await supabase
    .from("audit_log")
    .select("*, profiles!audit_log_actor_id_fkey(full_name, role)")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/admin" className="text-sm text-slate-500 hover:text-slate-900">
        ← Back
      </Link>
      <h1 className="mt-2 text-xl font-semibold text-slate-900">Audit Log</h1>
      <p className="text-sm text-slate-500">Full accountability trail — visible to Admin only.</p>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-2">When</th>
              <th className="px-4 py-2">Actor</th>
              <th className="px-4 py-2">Action</th>
              <th className="px-4 py-2">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {entries?.map((entry) => {
              const actor = entry.profiles as unknown as { full_name: string; role: string } | null;
              return (
                <tr key={entry.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    {new Date(entry.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-slate-800">
                    {actor?.full_name} <span className="text-xs text-slate-400">({actor?.role})</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{entry.action}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {entry.details ? JSON.stringify(entry.details) : ""}
                  </td>
                </tr>
              );
            })}
            {entries?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                  No activity yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
