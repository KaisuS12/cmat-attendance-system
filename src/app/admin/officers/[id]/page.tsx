import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ActivityEventSelect } from "@/components/ActivityEventSelect";
import { LiveSearch } from "@/components/LiveSearch";
import { ProofPhotoButton } from "@/components/ProofPhotoButton";
import { Badge, btnSecondary, EmptyState, PageTitle } from "@/components/ui";
import { slotLabel } from "@/lib/attendance-status";
import { formatDateTime } from "@/lib/datetime";
import { ACTIVITY_TABS, applyActivityTab, parseActivityParams, type ActivityTab } from "@/lib/officer-activity";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

interface ActivityRow {
  id: string;
  type: "sign_in" | "sign_out";
  method: "qr" | "manual";
  manual_reason: string | null;
  recorded_at: string;
  voided_at: string | null;
  student: { id: string; full_name: string; student_id: string | null; program: string | null; year_level: string | null };
  event_days: {
    day_date: string;
    session: string;
    title: string | null;
    event_id: string;
    events: { title: string };
  };
}

function ActionBadge({ row }: { row: ActivityRow }) {
  const label = row.type === "sign_in" ? "Sign in" : "Sign out";
  return row.method === "manual" ? <Badge tone="amber">Manual {label.toLowerCase()}</Badge> : <Badge tone="blue">{label} scan</Badge>;
}

const studentGroup = (r: ActivityRow) => [r.student.program, r.student.year_level].filter(Boolean).join(" ");
const eventDetail = (r: ActivityRow) => [slotLabel(r.event_days, "numeric"), r.event_days.title].filter(Boolean).join(" · ");

// One officer's or admin's scans and manual entries (admins only: this page
// sits under the admin layout). Built from the attendance records themselves,
// so it covers everything since the first event.
export default async function OfficerActivityPage({ params, searchParams }: PageProps<"/admin/officers/[id]">) {
  const { id } = await params;
  const { tab, q, event, page } = parseActivityParams(await searchParams);
  const supabase = await createClient();

  const { data: person } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, is_active")
    .eq("id", id)
    .maybeSingle();
  if (!person || (person.role !== "officer" && person.role !== "admin")) notFound();

  // Tab counts (not narrowed by the name search, so the totals stay stable).
  const countFor = async (t: ActivityTab, onlyVoided = false) => {
    let query = supabase
      .from("attendance_records")
      .select(event ? "id, event_days!inner(event_id)" : "id", { count: "exact", head: true })
      .eq("scanned_by", id);
    if (event) query = query.eq("event_days.event_id", event);
    if (onlyVoided) query = query.not("voided_at", "is", null);
    const { count } = await applyActivityTab(query, t);
    return count ?? 0;
  };

  let query = supabase
    .from("attendance_records")
    .select(
      "id, type, method, manual_reason, recorded_at, voided_at, student:profiles!attendance_records_student_id_fkey!inner(id, full_name, student_id, program, year_level), event_days!inner(day_date, session, title, event_id, events(title))",
      { count: "exact" }
    )
    .eq("scanned_by", id)
    .order("recorded_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  query = applyActivityTab(query, tab);
  if (event) query = query.eq("event_days.event_id", event);
  // Strip characters that have meaning inside a PostgREST or() filter.
  const term = q.replace(/[,()*%\\:"]/g, " ").trim();
  if (term) query = query.or(`full_name.ilike.%${term}%,student_id.ilike.%${term}%`, { referencedTable: "student" });

  const [{ data, count }, all, signIn, signOut, manual, voided, { data: eventRows }] = await Promise.all([
    query,
    countFor("all"),
    countFor("sign_in"),
    countFor("sign_out"),
    countFor("manual"),
    countFor("all", true),
    supabase.from("events").select("id, title").order("created_at", { ascending: false }).limit(200),
  ]);
  const rows = (data ?? []) as unknown as ActivityRow[];
  const counts: Record<ActivityTab, number> = { all, sign_in: signIn, sign_out: signOut, manual };
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  const href = (patch: { tab?: ActivityTab; page?: number }) => {
    const next = new URLSearchParams();
    const nextTab = patch.tab ?? tab;
    if (nextTab !== "all") next.set("tab", nextTab);
    if (q) next.set("q", q);
    if (event) next.set("event", event);
    if (patch.page && patch.page > 1) next.set("page", String(patch.page));
    return next.size ? `/admin/officers/${id}?${next}` : `/admin/officers/${id}`;
  };

  return (
    <div>
      <Link href="/admin/officers" className="inline-flex min-h-11 items-center text-sm text-slate-500 hover:text-slate-900">
        ← Officers
      </Link>
      <PageTitle title={person.full_name} subtitle={`${person.role === "admin" ? "Admin" : "Officer"} · ${person.email ?? "no email"}`} />
      {!person.is_active && (
        <div className="mt-2">
          <Badge tone="red">Deactivated</Badge>
        </div>
      )}

      <nav aria-label="Filter by action" className="mt-4 -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
        {ACTIVITY_TABS.map((t) => {
          const active = t.key === tab;
          return (
            <Link
              key={t.key}
              href={href({ tab: t.key })}
              scroll={false}
              aria-current={active ? "page" : undefined}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition ${
                active
                  ? "border-brand-700 bg-brand-700 font-semibold text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:border-gold-400 hover:bg-gold-100"
              }`}
            >
              {t.label}
              <span className={`text-xs tabular-nums ${active ? "text-brand-100" : "text-slate-400"}`}>{counts[t.key]}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-3">
        <ActivityEventSelect events={eventRows ?? []} value={event} />
      </div>
      <LiveSearch initialQuery={q} placeholder="Search student name or ID" />

      <p className="mt-3 text-sm text-slate-500">
        {count ?? 0} {count === 1 ? "record" : "records"}
        {voided > 0 && <> · {voided} later voided by an admin</>}
      </p>

      <div className="mt-2">
        {rows.length === 0 ? (
          <EmptyState>{q || event || tab !== "all" ? "No records match these filters." : "No scans or manual entries yet."}</EmptyState>
        ) : (
          <>
            {/* Phones: cards */}
            <ul className="space-y-2 sm:hidden">
              {rows.map((r) => (
                <li key={r.id} className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <ActionBadge row={r} />
                    <span className="text-xs tabular-nums text-slate-500">{formatDateTime(r.recorded_at)}</span>
                  </div>
                  <Link href={`/admin/students/${r.student.id}`} className="mt-2 block font-medium text-slate-900">
                    {r.student.full_name}
                  </Link>
                  <p className="text-sm text-slate-500">{[r.student.student_id, studentGroup(r)].filter(Boolean).join(" · ")}</p>
                  <p className="mt-1 text-sm text-slate-600">{r.event_days.events.title}</p>
                  <p className="text-xs text-slate-500">{eventDetail(r)}</p>
                  {r.manual_reason && <p className="mt-1 text-xs text-amber-800">Reason: {r.manual_reason}</p>}
                  {r.method === "manual" && (
                    <p className="mt-1">
                      <ProofPhotoButton recordId={r.id} className="inline-flex min-h-9 items-center text-sm font-medium text-brand-700 underline" />
                    </p>
                  )}
                  {r.voided_at && <p className="mt-1"><Badge tone="red">Voided</Badge></p>}
                </li>
              ))}
            </ul>

            {/* Wider screens: table */}
            <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white sm:block">
              <table className="w-full text-sm">
                <thead className="bg-gold-100 text-left text-xs uppercase tracking-wide text-gold-600">
                  <tr>
                    <th className="px-4 py-2">Time</th>
                    <th className="px-4 py-2">Action</th>
                    <th className="px-4 py-2">Student</th>
                    <th className="px-4 py-2">Event</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 align-top">
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-slate-600">{formatDateTime(r.recorded_at)}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          <ActionBadge row={r} />
                          {r.voided_at && <Badge tone="red">Voided</Badge>}
                        </div>
                        {r.manual_reason && <p className="mt-1 text-xs text-amber-800">Reason: {r.manual_reason}</p>}
                        {r.method === "manual" && (
                          <ProofPhotoButton recordId={r.id} className="mt-1 block text-xs font-medium text-brand-700 underline" />
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <Link href={`/admin/students/${r.student.id}`} className="font-medium text-slate-800 hover:underline">
                          {r.student.full_name}
                        </Link>
                        <span className="block text-xs text-slate-500">{[r.student.student_id, studentGroup(r)].filter(Boolean).join(" · ")}</span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {r.event_days.events.title}
                        <span className="block text-xs text-slate-500">{eventDetail(r)}</span>
                      </td>
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
            <Link href={href({ page: page - 1 })} className={btnSecondary}>
              ← Newer
            </Link>
          ) : (
            <span />
          )}
          <span className="text-slate-500">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={href({ page: page + 1 })} className={btnSecondary}>
              Older →
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}
