import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/session";
import { EditWindowControl } from "@/components/EditWindowControl";
import { EditEventForm } from "@/components/EditEventForm";
import { AddDayForm } from "@/components/AddDayForm";
import { DeleteEventButton } from "@/components/DeleteEventButton";
import { RemoveDayButton } from "@/components/RemoveDayButton";
import { DayAttendanceTable } from "@/components/DayAttendanceTable";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Badge, btnPrimary, btnSecondary, PageTitle } from "@/components/ui";
import { formatDayDate, formatShortDateTime, todayInAppTz, windowState } from "@/lib/datetime";
import { describeTargets, isTargeted } from "@/lib/eligibility";
import { dayCounts, dayStats, loadDayAttendance, loadEligibleStudents } from "@/lib/reports";
import type { EventDay, EventRecord, Venue } from "@/types/database";

export const dynamic = "force-dynamic";

type EventWithDays = EventRecord & { venues: Venue; event_days: EventDay[] };

function percent(rate: number | null) {
  return rate === null ? "—" : `${Math.round(rate * 100)}%`;
}

function StatTile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-xl font-semibold text-slate-900">{value}</dd>
      {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

export default async function EventDetailPage({ params }: PageProps<"/officer/events/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const profile = await getCurrentProfile();

  const { data: event } = await supabase
    .from("events")
    .select("*, venues(*), event_days(*)")
    .eq("id", id)
    .single<EventWithDays>();

  if (!event) notFound();

  const days = [...event.event_days].sort((a, b) => a.day_date.localeCompare(b.day_date));
  const [byDay, eligible] = await Promise.all([
    loadDayAttendance(supabase, days.map((d) => d.id)),
    loadEligibleStudents(supabase, event),
  ]);
  const totalRecords = [...byDay.values()].reduce((n, rows) => n + rows.length, 0);
  const today = todayInAppTz();
  const canVoid = profile?.role === "admin";

  return (
    <div>
      <AutoRefresh intervalMs={30_000} />

      <Link href="/officer" className="inline-flex min-h-11 items-center text-sm text-slate-500 hover:text-slate-900">
        ← Events
      </Link>
      <PageTitle
        title={event.title}
        subtitle={
          <>
            {event.venues.name} · {event.venues.radius_meters} m radius
          </>
        }
        actions={
          <>
            <a href={`/api/events/${event.id}/export`} className={btnSecondary}>
              Export CSV
            </a>
            {totalRecords === 0 && <DeleteEventButton eventId={event.id} title={event.title} />}
          </>
        }
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge tone={isTargeted(event) ? "blue" : "slate"}>{describeTargets(event)}</Badge>
        <span className="text-xs text-slate-500">{eligible.length} students expected</span>
      </div>
      {event.description && <p className="mt-2 text-sm text-slate-600">{event.description}</p>}
      <EditEventForm event={event} />

      <div className="mt-6 space-y-5">
        {days.map((day) => {
          const rows = byDay.get(day.id) ?? [];
          const counts = dayCounts(rows);
          const stats = dayStats(rows, eligible);
          const signIn = windowState(day.sign_in_start, day.sign_in_end);
          const signOut = windowState(day.sign_out_start, day.sign_out_end);
          const live = signIn === "open" || signOut === "open";

          return (
            <section key={day.id} className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-slate-900">{formatDayDate(day.day_date, "long")}</h2>
                  {live ? (
                    <Badge tone="green">Live</Badge>
                  ) : day.day_date === today ? (
                    <Badge tone="blue">Today</Badge>
                  ) : null}
                </div>
                <Link href={`/officer/scan/${day.id}`} className={`${btnPrimary} min-h-11 w-full sm:w-auto`}>
                  Open scanner
                </Link>
              </div>

              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs font-medium text-slate-500">Sign-in window</p>
                  <p className="mt-0.5 text-slate-700">
                    {formatShortDateTime(day.sign_in_start)} – {formatShortDateTime(day.sign_in_end)}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs font-medium text-slate-500">Sign-out window</p>
                  <p className="mt-0.5 text-slate-700">
                    {formatShortDateTime(day.sign_out_start)} – {formatShortDateTime(day.sign_out_end)}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <EditWindowControl eventId={event.id} day={day} />
                {days.length > 1 && rows.length === 0 && (
                  <RemoveDayButton eventId={event.id} dayId={day.id} label={formatDayDate(day.day_date, "long")} />
                )}
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <StatTile label="Expected" value={stats.expected} />
                <StatTile label="Signed in" value={counts.signedIn} />
                <StatTile label="Signed in & out" value={counts.complete} />
                <StatTile
                  label="Attendance rate"
                  value={percent(stats.signedInRate)}
                  hint={stats.completeRate !== null ? `${percent(stats.completeRate)} complete` : undefined}
                />
              </dl>

              <div className="mt-2 flex justify-end">
                {stats.missing.length > 0 && (
                  <a
                    href={`/api/events/${event.id}/days/${day.id}/missing`}
                    className="text-xs font-medium text-slate-500 underline hover:text-slate-900"
                  >
                    Download missing list (CSV)
                  </a>
                )}
              </div>

              <DayAttendanceTable rows={rows} missing={stats.missing} sections={stats.sections} canVoid={canVoid} />
            </section>
          );
        })}

        <AddDayForm eventId={event.id} />
      </div>
    </div>
  );
}
