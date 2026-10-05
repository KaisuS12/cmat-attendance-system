import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Scanner } from "@/components/Scanner";
import { ENABLE_TOKEN_DEBUG_TOOLS } from "@/lib/constants";
import type { EventDay } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function ScannerPage({ params }: PageProps<"/officer/scan/[eventDayId]">) {
  const { eventDayId } = await params;
  const supabase = await createClient();

  const countFor = (type: "sign_in" | "sign_out") =>
    supabase
      .from("attendance_records")
      .select("id", { count: "exact", head: true })
      .eq("event_day_id", eventDayId)
      .eq("type", type)
      .is("voided_at", null);

  // The day lookup and both counts are independent; run them together.
  const [{ data: day }, { count: signIns }, { count: signOuts }] = await Promise.all([
    supabase
      .from("event_days")
      .select("*, events(id, title, venues(name))")
      .eq("id", eventDayId)
      .single<EventDay & { events: { id: string; title: string; venues: { name: string } } }>(),
    countFor("sign_in"),
    countFor("sign_out"),
  ]);

  if (!day) notFound();

  return (
    <Scanner
      day={day}
      eventId={day.events.id}
      eventTitle={day.events.title}
      venueName={day.events.venues.name}
      initialCounts={{ sign_in: signIns ?? 0, sign_out: signOuts ?? 0 }}
      debugTools={ENABLE_TOKEN_DEBUG_TOOLS}
    />
  );
}
