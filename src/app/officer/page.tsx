import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge, btnPrimary, EmptyState, PageTitle } from "@/components/ui";
import { formatDayDate, todayInAppTz, windowState, requestTime } from "@/lib/datetime";
import { describeTargets, isTargeted } from "@/lib/eligibility";
import type { EventDay, EventRecord, Venue } from "@/types/database";

export const dynamic = "force-dynamic";

type EventWithDays = EventRecord & { venues: Venue; event_days: EventDay[] };

function dateRange(days: EventDay[]) {
  if (days.length === 0) return "No days";
  const first = formatDayDate(days[0].day_date, "numeric");
  if (days.length === 1) return first;
  return `${first} – ${formatDayDate(days[days.length - 1].day_date, "numeric")} (${days.length} days)`;
}

export default async function OfficerDashboard() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select("*, venues(*), event_days(*)")
    .order("created_at", { ascending: false });

  const now = requestTime();
  const today = todayInAppTz();
  const events = ((data ?? []) as EventWithDays[]).map((e) => ({
    ...e,
    event_days: [...e.event_days].sort((a, b) => a.day_date.localeCompare(b.day_date)),
  }));

  const isOver = (e: EventWithDays) =>
    e.event_days.length > 0 && e.event_days.every((d) => new Date(d.sign_out_end).getTime() < now);
  const active = events
    .filter((e) => !isOver(e))
    .sort((a, b) => (a.event_days[0]?.day_date ?? "").localeCompare(b.event_days[0]?.day_date ?? ""));
  const past = events.filter(isOver);

  function renderEvent(event: EventWithDays) {
    const live = event.event_days.some(
      (d) =>
        windowState(d.sign_in_start, d.sign_in_end, now) === "open" ||
        windowState(d.sign_out_start, d.sign_out_end, now) === "open"
    );
    const isToday = event.event_days.some((d) => d.day_date === today);
    return (
      <Link
        key={event.id}
        href={`/officer/events/${event.id}`}
        className="block rounded-xl border border-slate-200 border-l-4 border-l-gold-400 bg-white p-4 transition hover:border-gold-400 sm:p-5"
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-slate-900">{event.title}</h3>
          {live ? <Badge tone="green">Live</Badge> : isToday ? <Badge tone="gold">Today</Badge> : null}
        </div>
        <p className="mt-0.5 text-sm text-slate-500">
          {event.venues.name} · {dateRange(event.event_days)}
        </p>
        {isTargeted(event) && (
          <p className="mt-2">
            <Badge tone="blue">{describeTargets(event)}</Badge>
          </p>
        )}
      </Link>
    );
  }

  return (
    <div>
      <PageTitle
        title="Events"
        actions={
          <Link href="/officer/events/new" className={btnPrimary}>
            + New event
          </Link>
        }
      />

      <div className="mt-6 space-y-3">
        {active.length === 0 ? (
          <EmptyState>No upcoming events. Create one to get started.</EmptyState>
        ) : (
          active.map(renderEvent)
        )}
      </div>

      {past.length > 0 && (
        <details className="mt-8">
          <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wide text-slate-400">
            Past events ({past.length})
          </summary>
          <div className="mt-3 space-y-3">{past.map(renderEvent)}</div>
        </details>
      )}
    </div>
  );
}
