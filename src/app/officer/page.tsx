import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/SignOutButton";
import type { EventDay, EventRecord, Venue } from "@/types/database";

export const dynamic = "force-dynamic";

type EventWithDays = EventRecord & { venues: Venue; event_days: EventDay[] };

export default async function OfficerDashboard() {
  const supabase = await createClient();
  const { data: events } = await supabase
    .from("events")
    .select("*, venues(*), event_days(*)")
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Events</h1>
        <div className="flex items-center gap-4">
          <Link
            href="/officer/events/new"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            + New event
          </Link>
          <SignOutButton />
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {(events as EventWithDays[] | null)?.map((event) => (
          <Link
            key={event.id}
            href={`/officer/events/${event.id}`}
            className="block rounded-xl border border-slate-200 bg-white p-5 hover:border-slate-300"
          >
            <h3 className="font-medium text-slate-900">{event.title}</h3>
            <p className="text-sm text-slate-500">
              {event.venues.name} · {event.event_days.length} day
              {event.event_days.length === 1 ? "" : "s"}
            </p>
          </Link>
        ))}
        {(events?.length ?? 0) === 0 && (
          <p className="text-sm text-slate-500">No events yet. Create one to get started.</p>
        )}
      </div>
    </div>
  );
}
