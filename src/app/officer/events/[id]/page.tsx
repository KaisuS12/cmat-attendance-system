import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EditWindowControl } from "@/components/EditWindowControl";
import { AddDayForm } from "@/components/AddDayForm";
import { DeleteEventButton } from "@/components/DeleteEventButton";
import { DayAttendanceTable } from "@/components/DayAttendanceTable";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Badge, btnPrimary, btnSecondary, PageTitle } from "@/components/ui";
import { formatDayDate, formatShortDateTime, todayInAppTz, windowState } from "@/lib/datetime";
import { dayCounts, loadDayAttendance } from "@/lib/reports";
import type { EventDay, EventRecord, Venue } from "@/types/database";

export const dynamic = "force-dynamic";

type EventWithDays = EventRecord & { venues: Venue; event_days: EventDay[] };

export default async function EventDetailPage({ params }: PageProps<"/officer/events/[id]">) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("*, venues(*), event_days(*)")
    .eq("id", id)
    .single<EventWithDays>();

  if (!event) notFound();

  const days = [...event.event_days].sort((a, b) => a.day_date.localeCompare(b.day_date));
  const byDay = await loadDayAttendance(supabase, days.map((d) => d.id));
  const totalRecords = [...byDay.values()].reduce((n, rows) => n + rows.length, 0);
  const today = todayInAppTz();

  return (
    <div>
      <AutoRefresh intervalMs={30_000} />

      <Link href="/officer" className="text-sm text-slate-500 hover:text-slate-900">
        ← Events
      </Link>
      <div className="mt-2">
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
        {event.description && <p className="mt-2 text-sm text-slate-600">{event.description}</p>}
      </div>

      <div className="mt-6 space-y-5">
        {days.map((day) => {
          const rows = byDay.get(day.id) ?? [];
          const counts = dayCounts(rows);
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
                <Link href={`/officer/scan/${day.id}`} className={btnPrimary}>
                  Open scanner
                </Link>
              </div>

              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Sign-in window</p>
                  <p className="mt-0.5 text-slate-700">
                    {formatShortDateTime(day.sign_in_start)} – {formatShortDateTime(day.sign_in_end)}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Sign-out window</p>
                  <p className="mt-0.5 text-slate-700">
                    {formatShortDateTime(day.sign_out_start)} – {formatShortDateTime(day.sign_out_end)}
                  </p>
                </div>
              </div>
              <div className="mt-2">
                <EditWindowControl eventId={event.id} day={day} />
              </div>

              <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg border border-slate-100 p-2">
                  <dt className="text-[11px] uppercase tracking-wide text-slate-400">Signed in</dt>
                  <dd className="text-lg font-semibold tabular-nums text-slate-900">{counts.signedIn}</dd>
                </div>
                <div className="rounded-lg border border-slate-100 p-2">
                  <dt className="text-[11px] uppercase tracking-wide text-slate-400">Signed out</dt>
                  <dd className="text-lg font-semibold tabular-nums text-slate-900">{counts.signedOut}</dd>
                </div>
                <div className="rounded-lg border border-slate-100 p-2">
                  <dt className="text-[11px] uppercase tracking-wide text-slate-400">Complete</dt>
                  <dd className="text-lg font-semibold tabular-nums text-slate-900">{counts.complete}</dd>
                </div>
              </dl>

              <DayAttendanceTable rows={rows} />
            </section>
          );
        })}

        <AddDayForm eventId={event.id} />
      </div>
    </div>
  );
}
