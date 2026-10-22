"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DayWindowFields, dayToPayload, emptyDay, withDate, type DayInput } from "@/components/DayWindowFields";
import { TargetPicker, type Targets } from "@/components/TargetPicker";
import { emptyVenue, NEW_VENUE, SAME_VENUE, VenuePicker, venueToPayload, type VenueValue } from "@/components/VenuePicker";
import { Alert, btnPrimary, inputClass, labelClass, PageTitle } from "@/components/ui";
import type { Venue } from "@/types/database";

// Each day can have its own name and venue; both optional.
type DayDraft = DayInput & { title: string; venue: VenueValue };

const newDay = (base: DayInput = emptyDay()): DayDraft => ({ ...base, title: "", venue: emptyVenue(SAME_VENUE) });

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
  const [days, setDays] = useState<DayDraft[]>([newDay()]);
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
      return [...prev, last?.dayDate ? newDay(withDate(last, nextDate(last.dayDate))) : newDay()];
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const payloads = [];
    for (const [i, day] of days.entries()) {
      const label = days.length > 1 ? `Day ${i + 1}: ` : "";
      const p = dayToPayload(day);
      if (!p.ok) {
        setError(label + p.message);
        return;
      }
      const dayVenue = venueToPayload(day.venue);
      if (!dayVenue.ok) {
        setError(`${label}${dayVenue.message}`);
        return;
      }
      payloads.push({
        ...p.value,
        ...(day.title.trim() ? { title: day.title.trim() } : {}),
        ...(dayVenue.value ? { venue: dayVenue.value } : {}),
      });
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
            <div key={i} className="rounded-lg bg-slate-50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Day {i + 1}</span>
                {days.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setDays((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                )}
              </div>
              <label htmlFor={`day-${i}-title`} className="mb-3 block text-xs font-medium text-slate-500">
                Day title <span className="font-normal text-slate-400">(optional)</span>
                <input
                  id={`day-${i}-title`}
                  value={day.title}
                  maxLength={80}
                  onChange={(e) => {
                    const title = e.target.value;
                    setDays((prev) => prev.map((d, idx) => (idx === i ? { ...d, title } : d)));
                  }}
                  placeholder={i === 0 ? "e.g. Opening Ceremony" : "e.g. Field Day"}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm"
                />
              </label>
              <DayWindowFields
                value={day}
                onChange={(next) => setDays((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...next } : d)))}
              />
              <div className="mt-3">
                <p className="mb-1 text-xs font-medium text-slate-500">Venue for this day</p>
                <VenuePicker
                  id={`day-${i}-venue`}
                  venues={venues}
                  value={day.venue}
                  allowSame
                  onChange={(next) => setDays((prev) => prev.map((d, idx) => (idx === i ? { ...d, venue: next } : d)))}
                />
              </div>
            </div>
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
