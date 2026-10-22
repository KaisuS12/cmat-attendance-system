"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DayCard, dayCardOnDate, dayCardToPayloads, emptyDayCard, type DayCardValue } from "@/components/DayCard";
import { TargetPicker, type Targets } from "@/components/TargetPicker";
import { emptyVenue, NEW_VENUE, VenuePicker, venueToPayload, type VenueValue } from "@/components/VenuePicker";
import { Alert, btnPrimary, inputClass, labelClass, PageTitle } from "@/components/ui";
import type { Venue } from "@/types/database";

function nextDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export default function NewEventPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [venues, setVenues] = useState<Venue[]>([]);
  const [venue, setVenue] = useState<VenueValue>(emptyVenue());
  // Each day: optional title and venue, and one or more sessions.
  const [days, setDays] = useState<DayCardValue[]>([emptyDayCard()]);
  const [targets, setTargets] = useState<Targets>({ programs: [], yearLevels: [] });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let ignore = false;
    fetch("/api/venues")
      .then((res) => res.json())
      .then((data) => {
        if (ignore || !data.venues?.length) return;
        setVenues(data.venues);
        setVenue((v) => (v.choice === NEW_VENUE && !v.name && !v.latitude ? { ...v, choice: data.venues[0].id } : v));
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, []);

  function addDay() {
    setDays((prev) => {
      const last = prev[prev.length - 1];
      // Continue from the previous day, keeping its window times.
      return [...prev, last?.dayDate ? dayCardOnDate(last, nextDate(last.dayDate)) : emptyDayCard()];
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const payloads = [];
    for (const [i, day] of days.entries()) {
      if (!day.dayDate) {
        setError(days.length > 1 ? `Day ${i + 1}: pick a date.` : "Pick a date.");
        return;
      }
      const p = dayCardToPayloads(day, days.length > 1 ? `Day ${i + 1}: ` : "");
      if (!p.ok) {
        setError(p.message);
        return;
      }
      payloads.push(...p.value);
    }

    const eventVenue = venueToPayload(venue);
    if (!eventVenue.ok || !eventVenue.value) {
      setError(eventVenue.ok ? "Pick a venue." : eventVenue.message);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          venue: eventVenue.value,
          days: payloads,
          targetPrograms: targets.programs,
          targetYearLevels: targets.yearLevels,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not create the event.");
        return;
      }
      router.push(`/officer/events/${data.eventId}`);
      router.refresh();
    } catch {
      setError("Network error — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/officer" className="text-sm text-slate-500 hover:text-slate-900">
        ← Events
      </Link>
      <div className="mt-2">
        <PageTitle title="New event" subtitle="All times are Philippine time." />
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        <div className="space-y-4 rounded-xl border border-slate-200 border-t-4 border-t-gold-400 bg-white p-4 sm:p-5">
          <div>
            <label htmlFor="title" className={labelClass}>
              Title
            </label>
            <input
              id="title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. CMAT General Assembly"
              className={`${inputClass} mt-1`}
            />
          </div>
          <div>
            <label htmlFor="description" className={labelClass}>
              Description <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              id="description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`${inputClass} mt-1`}
            />
          </div>
        </div>

        <fieldset className="space-y-3 rounded-xl border border-slate-200 border-t-4 border-t-gold-400 bg-white p-4 sm:p-5">
          <legend className="px-1 text-sm font-semibold text-slate-900">Who should attend</legend>
          <TargetPicker value={targets} onChange={setTargets} />
        </fieldset>

        <fieldset className="space-y-3 rounded-xl border border-slate-200 border-t-4 border-t-gold-400 bg-white p-4 sm:p-5">
          <legend className="px-1 text-sm font-semibold text-slate-900">Venue</legend>
          <VenuePicker id="event-venue" venues={venues} value={venue} onChange={setVenue} />
          {days.length > 1 && (
            <p className="text-xs text-slate-500">Used for every day, unless you pick a different venue for a day below.</p>
          )}
        </fieldset>

        <fieldset className="space-y-4 rounded-xl border border-slate-200 border-t-4 border-t-gold-400 bg-white p-4 sm:p-5">
          <legend className="px-1 text-sm font-semibold text-slate-900">Days</legend>
          {days.map((day, i) => (
            <DayCard
              key={i}
              id={`day-${i}`}
              heading={`Day ${i + 1}`}
              value={day}
              venues={venues}
              titlePlaceholder={i === 0 ? "e.g. Opening Ceremony" : "e.g. Field Day"}
              onChange={(next) => setDays((prev) => prev.map((d, idx) => (idx === i ? next : d)))}
              onRemove={days.length > 1 ? () => setDays((prev) => prev.filter((_, idx) => idx !== i)) : undefined}
            />
          ))}
          <button type="button" onClick={addDay} className="text-sm font-medium text-slate-600 underline hover:text-slate-900">
            + Add another day
          </button>
        </fieldset>

        {error && <Alert kind="error">{error}</Alert>}

        <button type="submit" disabled={submitting} className={`${btnPrimary} w-full py-2.5`}>
          {submitting ? "Creating..." : "Create event"}
        </button>
      </form>
    </div>
  );
}
