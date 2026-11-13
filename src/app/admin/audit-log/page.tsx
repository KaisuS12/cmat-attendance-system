import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { btnSecondary, EmptyState, PageTitle } from "@/components/ui";
import { formatDayDate, formatTime, requestTime, todayInAppTz } from "@/lib/datetime";
import {
  AUDIT_CATEGORIES,
  auditEntryReferences,
  describeAuditEntry,
  emptyAuditNames,
  type AuditEntryInput,
  type AuditNames,
} from "@/lib/audit-describe";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;

// Scans and QR codes happen by the thousand at every event, so "All changes"
// leaves them out; they have their own button.
const NOISY_ACTIONS = AUDIT_CATEGORIES.find((c) => c.key === "scans")!.actions;

type Entry = AuditEntryInput & {
  id: string;
  created_at: string;
  profiles: { full_name: string; role: string } | null;
};

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Names for the events, days, people, venues and semesters the entries
// mention, in at most five small queries for the whole page.
async function loadNames(supabase: Supabase, entries: Entry[]): Promise<AuditNames> {
  const names = emptyAuditNames();
  const ids = { eventIds: new Set<string>(), dayIds: new Set<string>(), peopleIds: new Set<string>(), semesterIds: new Set<string>(), venueIds: new Set<string>() };
  for (const e of entries) {
    const refs = auditEntryReferences(e);
    for (const key of Object.keys(ids) as (keyof typeof ids)[]) refs[key].forEach((id) => ids[key].add(id));
  }
  const list = (s: Set<string>) => [...s];

  const [events, days, people, venues, semesters] = await Promise.all([
    ids.eventIds.size ? supabase.from("events").select("id, title").in("id", list(ids.eventIds)) : null,
    ids.dayIds.size
      ? supabase.from("event_days").select("id, day_date, session, event_id, events(title)").in("id", list(ids.dayIds))
      : null,
    ids.peopleIds.size ? supabase.from("profiles").select("id, full_name").in("id", list(ids.peopleIds)) : null,
    ids.venueIds.size ? supabase.from("venues").select("id, name").in("id", list(ids.venueIds)) : null,
    ids.semesterIds.size ? supabase.from("semesters").select("id, name").in("id", list(ids.semesterIds)) : null,
  ]);

  for (const r of events?.data ?? []) names.events.set(r.id, r.title);
  for (const r of (days?.data ?? []) as unknown as {
    id: string;
    day_date: string;
    session: string | null;
    event_id: string;
    events: { title: string } | null;
  }[]) {
    names.days.set(r.id, { day_date: r.day_date, session: r.session, event_id: r.event_id, eventTitle: r.events?.title ?? "Event" });
    if (r.events) names.events.set(r.event_id, r.events.title);
  }
  for (const r of people?.data ?? []) names.people.set(r.id, r.full_name);
  for (const r of venues?.data ?? []) names.venues.set(r.id, r.name);
  for (const r of semesters?.data ?? []) names.semesters.set(r.id, r.name);
  return names;
}

const ROLE_LABEL: Record<string, string> = { admin: "Admin", officer: "Officer", student: "Student" };

export default async function AuditLogPage({ searchParams }: PageProps<"/admin/audit-log">) {
  const params = await searchParams;
  const cat = typeof params.cat === "string" ? params.cat : "";
  const legacyAction = typeof params.action === "string" ? params.action : ""; // old links
  const page = Math.max(1, Number(typeof params.page === "string" ? params.page : 1) || 1);
  const category = AUDIT_CATEGORIES.find((c) => c.key === cat);

  const supabase = await createClient();
  let query = supabase
    .from("audit_log")
    .select("id, created_at, action, entity_type, entity_id, details, profiles!audit_log_actor_id_fkey(full_name, role)")
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE); // one extra row tells us if there's a next page

  if (category) query = query.in("action", [...category.actions]);
  else if (legacyAction && legacyAction !== "all") query = query.eq("action", legacyAction);
  else if (legacyAction !== "all") query = query.not("action", "in", `(${NOISY_ACTIONS.join(",")})`);

  const { data } = await query;
  const rows = (data ?? []) as unknown as Entry[];
  const entries = rows.slice(0, PAGE_SIZE);
  const hasNext = rows.length > PAGE_SIZE;
  const names = await loadNames(supabase, entries);

  // Group by Manila calendar day: Today, Yesterday, then dates.
  const today = todayInAppTz(new Date(requestTime()));
  const yesterday = todayInAppTz(new Date(requestTime() - 24 * 60 * 60 * 1000));
  const dayLabel = (day: string) =>
    day === today ? "Today" : day === yesterday ? `Yesterday · ${formatDayDate(day)}` : formatDayDate(day, "long");
  const groups: { day: string; entries: Entry[] }[] = [];
  for (const e of entries) {
    const day = todayInAppTz(new Date(e.created_at));
    if (groups.at(-1)?.day !== day) groups.push({ day, entries: [] });
    groups.at(-1)!.entries.push(e);
  }

  const query_ = (patch: { cat?: string; page?: number }) => {
    const next = new URLSearchParams();
    const c = patch.cat ?? cat;
    if (c) next.set("cat", c);
    if ((patch.page ?? 1) > 1) next.set("page", String(patch.page));
    return next.size ? `/admin/audit-log?${next}` : "/admin/audit-log";
  };
  const pills = [{ key: "", label: "All changes" }, ...AUDIT_CATEGORIES.map((c) => ({ key: c.key, label: c.label }))];
  const dotFor = (action: string) =>
    AUDIT_CATEGORIES.find((c) => (c.actions as readonly string[]).includes(action))?.dot ?? "bg-slate-300";

  return (
    <div>
      <PageTitle title="Audit log" subtitle="Who did what, and when. Visible to admins only." />

      <nav aria-label="Filter by type" className="mt-5 -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
        {pills.map((p) => {
          const active = p.key === cat && !legacyAction;
          return (
            <Link
              key={p.key || "all"}
              href={query_({ cat: p.key, page: 1 })}
              scroll={false}
              aria-current={active ? "page" : undefined}
              className={`inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-sm transition ${
                active
                  ? "border-brand-700 bg-brand-700 font-semibold text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:border-gold-400 hover:bg-gold-100"
              }`}
            >
              {p.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-5">
        {groups.length === 0 ? (
          <EmptyState>Nothing here yet.</EmptyState>
        ) : (
          <div className="space-y-6">
            {groups.map((g) => (
              <section key={g.day} aria-label={dayLabel(g.day)}>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gold-600">{dayLabel(g.day)}</h2>
                <ol className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
                  {g.entries.map((entry) => {
                    const info = describeAuditEntry(entry, names);
                    const actor = entry.profiles;
                    return (
                      <li key={entry.id} className="flex gap-3 px-4 py-3">
                        <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${dotFor(entry.action)}`} aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-slate-500">
                            <span className="tabular-nums">{formatTime(entry.created_at)}</span> ·{" "}
                            <span className="font-medium text-slate-700">{actor?.full_name ?? "A removed account"}</span>
                            {actor?.role && <> · {ROLE_LABEL[actor.role] ?? actor.role}</>}
                          </p>
                          <p className="mt-0.5 text-sm text-slate-900">{info.sentence}</p>
                          {info.changes.length > 0 && (
                            <ul className="mt-1 space-y-0.5 text-sm text-slate-600">
                              {info.changes.map((c) => (
                                <li key={c.label} className="break-words">
                                  <span className="font-medium text-slate-700">{c.label}:</span>{" "}
                                  <span className="text-slate-500 line-through decoration-slate-300">{c.from}</span>{" "}
                                  <span aria-label="changed to">→</span> {c.to}
                                </li>
                              ))}
                            </ul>
                          )}
                          {info.note && <p className="mt-1 break-words text-xs text-slate-500">{info.note}</p>}
                        </div>
                        {info.href && (
                          <Link
                            href={info.href.url}
                            className="hidden shrink-0 self-center text-xs font-medium text-brand-700 hover:underline sm:block"
                          >
                            {info.href.label} →
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </section>
            ))}
          </div>
        )}
      </div>

      {(page > 1 || hasNext) && (
        <div className="mt-4 flex justify-between">
          {page > 1 ? (
            <Link href={query_({ page: page - 1 })} className={btnSecondary}>
              ← Newer
            </Link>
          ) : (
            <span />
          )}
          {hasNext && (
            <Link href={query_({ page: page + 1 })} className={btnSecondary}>
              Older →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
