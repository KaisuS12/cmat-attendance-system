import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/session";
import { AttendanceAction } from "@/components/AttendanceAction";
import { SignOutButton } from "@/components/SignOutButton";
import type { EventDay, EventRecord, Venue } from "@/types/database";

export const dynamic = "force-dynamic";

type EventWithDays = EventRecord & { venues: Venue; event_days: EventDay[] };

function windowStatus(startIso: string, endIso: string) {
  const now = Date.now();
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (now < start) return "not_open" as const;
  if (now > end) return "closed" as const;
  return "open" as const;
}

export default async function StudentDashboard() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: events } = await supabase
    .from("events")
    .select("*, venues(*), event_days(*)")
    .order("created_at", { ascending: false });

  const { data: myRecords } = await supabase
    .from("attendance_records")
    .select("event_day_id, type")
    .eq("student_id", profile?.id ?? "");

  const recordedSet = new Set((myRecords ?? []).map((r) => `${r.event_day_id}:${r.type}`));

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Hi, {profile?.full_name}</h1>
          <p className="text-sm text-slate-500">Student ID: {profile?.student_id}</p>
        </div>
        <div className="flex items-center gap-3">
          <a href="/student/history" className="text-sm font-medium text-slate-600 hover:text-slate-900">
            My attendance
          </a>
          <SignOutButton />
        </div>
      </div>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-slate-400">Events</h2>

      <div className="mt-3 space-y-4">
        {(events as EventWithDays[] | null)?.length === 0 && (
          <p className="text-sm text-slate-500">No events yet.</p>
        )}

        {(events as EventWithDays[] | null)?.map((event) => (
          <div key={event.id} className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="font-medium text-slate-900">{event.title}</h3>
            <p className="text-sm text-slate-500">{event.venues.name}</p>
            {event.description && <p className="mt-1 text-sm text-slate-600">{event.description}</p>}

            <div className="mt-4 space-y-3">
              {event.event_days
                .sort((a, b) => a.day_date.localeCompare(b.day_date))
                .map((day) => {
                  const signInState = windowStatus(day.sign_in_start, day.sign_in_end);
                  const signOutState = windowStatus(day.sign_out_start, day.sign_out_end);
                  const signedIn = recordedSet.has(`${day.id}:sign_in`);
                  const signedOut = recordedSet.has(`${day.id}:sign_out`);

                  return (
                    <div key={day.id} className="rounded-lg bg-slate-50 p-3">
                      <p className="text-sm font-medium text-slate-700">
                        {new Date(day.day_date).toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                      <div className="mt-2 flex gap-3">
                        {signedIn ? (
                          <span className="text-sm text-emerald-600">✓ Signed in</span>
                        ) : (
                          <AttendanceAction
                            eventDayId={day.id}
                            type="sign_in"
                            disabled={signInState !== "open"}
                            disabledReason={
                              signInState === "not_open" ? "Sign-in not open yet" : signInState === "closed" ? "Sign-in window closed" : undefined
                            }
                          />
                        )}
                        {signedOut ? (
                          <span className="text-sm text-emerald-600">✓ Signed out</span>
                        ) : (
                          <AttendanceAction
                            eventDayId={day.id}
                            type="sign_out"
                            disabled={signOutState !== "open"}
                            disabledReason={
                              signOutState === "not_open" ? "Sign-out not open yet" : signOutState === "closed" ? "Sign-out window closed" : undefined
                            }
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
