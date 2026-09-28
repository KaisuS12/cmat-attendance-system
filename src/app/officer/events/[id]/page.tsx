import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ExtendWindowControl } from "@/components/ExtendWindowControl";
import type { EventDay, EventRecord, Venue } from "@/types/database";

export const dynamic = "force-dynamic";

type EventWithDays = EventRecord & { venues: Venue; event_days: EventDay[] };

function fmt(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("*, venues(*), event_days(*)")
    .eq("id", id)
    .single<EventWithDays>();

  if (!event) notFound();

  const dayIds = event.event_days.map((d) => d.id);
  const { data: attendance } = await supabase
    .from("attendance_records")
    .select("*, profiles!attendance_records_student_id_fkey(full_name, student_id)")
    .in("event_day_id", dayIds.length > 0 ? dayIds : ["00000000-0000-0000-0000-000000000000"]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/officer" className="text-sm text-slate-500 hover:text-slate-900">
        ← Back
      </Link>
      <h1 className="mt-2 text-xl font-semibold text-slate-900">{event.title}</h1>
      <p className="text-sm text-slate-500">
        {event.venues.name} · {event.venues.radius_meters}m radius
      </p>

      <div className="mt-6 space-y-5">
        {event.event_days
          .sort((a, b) => a.day_date.localeCompare(b.day_date))
          .map((day) => {
            const dayAttendance = (attendance ?? []).filter((a) => a.event_day_id === day.id);
            return (
              <div key={day.id} className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-slate-900">
                    {new Date(day.day_date).toLocaleDateString(undefined, {
                      weekday: "long",
                      month: "short",
                      day: "numeric",
                    })}
                  </h3>
                  <Link
                    href={`/officer/scan/${day.id}`}
                    className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700"
                  >
                    Open scanner
                  </Link>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500">
                      Sign-in: {fmt(day.sign_in_start)} – {fmt(day.sign_in_end)}
                    </p>
                    <ExtendWindowControl
                      eventId={event.id}
                      dayId={day.id}
                      field="signInEnd"
                      currentValue={day.sign_in_end}
                    />
                  </div>
                  <div>
                    <p className="text-slate-500">
                      Sign-out: {fmt(day.sign_out_start)} – {fmt(day.sign_out_end)}
                    </p>
                    <ExtendWindowControl
                      eventId={event.id}
                      dayId={day.id}
                      field="signOutEnd"
                      currentValue={day.sign_out_end}
                    />
                  </div>
                </div>

                <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-400">
                  {dayAttendance.length} record{dayAttendance.length === 1 ? "" : "s"}
                </p>
              </div>
            );
          })}
      </div>
    </div>
  );
}
