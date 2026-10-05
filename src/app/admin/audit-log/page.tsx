import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { btnSecondary, EmptyState, PageTitle } from "@/components/ui";
import { formatDateTime } from "@/lib/datetime";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;

const ACTION_LABELS: Record<string, string> = {
  event_created: "Created event",
  event_deleted: "Deleted event",
  event_day_added: "Added event day",
  event_day_window_updated: "Changed time window",
  attendance_scanned: "Scanned attendance",
  attendance_manual_entry: "Manual attendance entry",
  qr_token_generated: "Generated QR",
  officer_account_created: "Created officer",
  students_bulk_imported: "Imported students",
  semester_created: "Created semester",
  semester_activated: "Set active semester",
  password_reset: "Reset password",
  password_changed: "Changed own password",
  account_deactivated: "Deactivated account",
  account_reactivated: "Reactivated account",
};

// High-volume entries are hidden by default so settings changes stand out.
const NOISY_ACTIONS = ["qr_token_generated", "attendance_scanned"];

function formatDetails(details: Record<string, unknown> | null): string {
  if (!details) return "";
  return Object.entries(details)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join(" · ");
}

export default async function AuditLogPage({ searchParams }: PageProps<"/admin/audit-log">) {
  const params = await searchParams;
  const action = typeof params.action === "string" ? params.action : "";
  const page = Math.max(1, Number(typeof params.page === "string" ? params.page : 1) || 1);

  const supabase = await createClient();
  let query = supabase
    .from("audit_log")
    .select("*, profiles!audit_log_actor_id_fkey(full_name, role)")
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE); // one extra row tells us if there's a next page

  if (action === "all") {
    // everything
  } else if (action) {
    query = query.eq("action", action);
  } else {
    query = query.not("action", "in", `(${NOISY_ACTIONS.join(",")})`);
  }

  const { data } = await query;
  const entries = (data ?? []).slice(0, PAGE_SIZE);
  const hasNext = (data ?? []).length > PAGE_SIZE;
  const href = (p: number) => `/admin/audit-log?${new URLSearchParams({ ...(action ? { action } : {}), page: String(p) })}`;

  return (
    <div>
      <PageTitle title="Audit log" subtitle="Accountability trail — visible to admins only." />

      <form className="mt-6 flex flex-wrap gap-2" action="/admin/audit-log">
        <select
          name="action"
          defaultValue={action}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">Changes (hide scans & QR generation)</option>
          <option value="all">Everything</option>
          {Object.entries(ACTION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button type="submit" className={btnSecondary}>
          Filter
        </button>
      </form>

      <div className="mt-4">
        {entries.length === 0 ? (
          <EmptyState>No matching activity.</EmptyState>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-2">When</th>
                  <th className="px-4 py-2">Who</th>
                  <th className="px-4 py-2">Action</th>
                  <th className="px-4 py-2">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 align-top">
                {entries.map((entry) => {
                  const actor = entry.profiles as unknown as { full_name: string; role: string } | null;
                  return (
                    <tr key={entry.id}>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDateTime(entry.created_at)}</td>
                      <td className="px-4 py-3 text-slate-800">
                        {actor?.full_name} <span className="text-xs text-slate-400">({actor?.role})</span>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{ACTION_LABELS[entry.action] ?? entry.action}</td>
                      <td className="max-w-md break-words px-4 py-3 text-xs text-slate-500">
                        {formatDetails(entry.details)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(page > 1 || hasNext) && (
        <div className="mt-4 flex justify-between">
          {page > 1 ? (
            <Link href={href(page - 1)} className={btnSecondary}>
              ← Newer
            </Link>
          ) : (
            <span />
          )}
          {hasNext && (
            <Link href={href(page + 1)} className={btnSecondary}>
              Older →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
