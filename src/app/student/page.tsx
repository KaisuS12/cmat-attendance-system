import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/session";
import { AttendanceAction } from "@/components/AttendanceAction";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Badge, EmptyState, PageTitle } from "@/components/ui";
import { formatDayDate, formatTime, todayInAppTz, windowState, type WindowState, requestTime } from "@/lib/datetime";
import { isEventForStudent } from "@/lib/eligibility";
import type { EventDay, EventRecord, Venue } from "@/types/database";

export const dynamic = "force-dynamic";

type EventWithDays = EventRecord & { venues: Venue; event_days: EventDay[] };

function disabledReason(state: WindowState, day: EventDay, type: "sign_in" | "sign_out") {
  const start = type === "sign_in" ? day.sign_in_start : day.sign_out_start;
  const noun = type === "sign_in" ? "Sign-in" : "Sign-out";
  if (state === "not_open") return `${noun} opens at ${formatTime(start)}`;
  if (state === "closed") return `${noun} closed`;
  return undefined;
}

export default async function StudentDashboard() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: activeSemester } = await supabase
    .from("semesters")
    .select("id, name")
    .eq("is_active", true)
    .maybeSingle();

  let eventsQuery = supabase
    .from("events")
    .select("*, venues(*), event_days(*)")
    .order("created_at", { ascending: false });
  if (activeSemester) {
    // Events created before semesters were set up have no semester; keep them visible.
    eventsQuery = eventsQuery.or(`semester_id.eq.${activeSemester.id},semester_id.is.null`);
  }
  const { data: eventRows } = await eventsQuery;

  const { data: myRecords } = await supabase
    .from("attendance_records")
    .select("event_day_id, type")
    .eq("student_id", profile?.id ?? "")
    .is("voided_at", null);

  const recordedSet = new Set((myRecords ?? []).map((r) => `${r.event_day_id}:${r.type}`));
  const now = requestTime();
  const today = todayInAppTz();

  const events = ((eventRows ?? []) as EventWithDays[])
    .filter((e) => !profile || isEventForStudent(e, profile))
    .map((e) => ({
    ...e,
    event_days: [...e.event_days].sort((a, b) => a.day_date.localeCompare(b.day_date)),
  }));

  const lastEnd = (e: EventWithDays) => Math.max(...e.event_days.map((d) => new Date(d.sign_out_end).getTime()));
  const firstStart = (e: EventWithDays) => Math.min(...e.event_days.map((d) => new Date(d.sign_in_start).getTime()));

  const happening = events.filter((e) => e.event_days.some((d) => d.day_date === today) && lastEnd(e) >= now);
  const upcoming = events
    .filter((e) => !happening.includes(e) && e.event_days.length > 0 && lastEnd(e) >= now)
    .sort((a, b) => firstStart(a) - firstStart(b));
  const past = events.filter((e) => !happening.includes(e) && !upcoming.includes(e));

  function renderEvent(event: EventWithDays, interactive: boolean) {
    return (
      <div key={event.id} className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h3 className="font-semibold text-slate-900">{event.title}</h3>
        <p className="text-sm text-slate-500">{event.venues.name}</p>
        {event.description && <p className="mt-1 text-sm text-slate-600">{event.description}</p>}

        <div className="mt-4 space-y-3">
          {event.event_days.map((day) => {
            const signInState = windowState(day.sign_in_start, day.sign_in_end, now);
            const signOutState = windowState(day.sign_out_start, day.sign_out_end, now);
            const signedIn = recordedSet.has(`${day.id}:sign_in`);
            const signedOut = recordedSet.has(`${day.id}:sign_out`);

            return (
              <div key={day.id} className="rounded-lg bg-slate-50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-800">
                    {formatDayDate(day.day_date)}
                    {day.day_date === today && <span className="ml-2"><Badge tone="blue">Today</Badge></span>}
                  </p>
                  <p className="text-xs text-slate-500">
                    In {formatTime(day.sign_in_start)}–{formatTime(day.sign_in_end)} · Out{" "}
                    {formatTime(day.sign_out_start)}–{formatTime(day.sign_out_end)}
                  </p>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {signedIn ? (
                    <span className="text-sm font-medium text-emerald-600">✓ Signed in</span>
                  ) : interactive ? (
                    <AttendanceAction
                      eventDayId={day.id}
                      type="sign_in"
                      disabled={signInState !== "open"}
                      disabledReason={disabledReason(signInState, day, "sign_in")}
                    />
                  ) : (
                    <span className="text-sm text-slate-400">No sign-in</span>
                  )}
                  {signedOut ? (
                    <span className="text-sm font-medium text-emerald-600">✓ Signed out</span>
                  ) : interactive ? (
                    <AttendanceAction
                      eventDayId={day.id}
                      type="sign_out"
                      disabled={signOutState !== "open"}
                      disabledReason={disabledReason(signOutState, day, "sign_out")}
                    />
                  ) : (
                    <span className="text-sm text-slate-400">No sign-out</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Re-render every minute so windows open/close without a manual reload. */}
      <AutoRefresh intervalMs={60_000} />

      <PageTitle
        title={`Hi, ${profile?.full_name?.split(" ")[0] ?? "there"}`}
        subtitle={
          <>
            Student ID {profile?.student_id}
            {activeSemester && <> · {activeSemester.name}</>}
          </>
        }
      />

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Happening today</h2>
        <div className="mt-3 space-y-4">
          {happening.length === 0 ? (
            <EmptyState>No events today.</EmptyState>
          ) : (
            happening.map((e) => renderEvent(e, true))
          )}
        </div>
      </section>

      {upcoming.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Upcoming</h2>
          <div className="mt-3 space-y-4">{upcoming.map((e) => renderEvent(e, true))}</div>
        </section>
      )}

      {past.length > 0 && (
        <details className="mt-8">
          <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wide text-slate-400">
            Past events ({past.length})
          </summary>
          <div className="mt-3 space-y-4">{past.map((e) => renderEvent(e, false))}</div>
        </details>
      )}
    </div>
  );
}
