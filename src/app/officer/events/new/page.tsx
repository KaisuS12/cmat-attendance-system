"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DayWindowFields, dayToPayload, emptyDay, withDate, type DayInput } from "@/components/DayWindowFields";
import { Alert, btnPrimary, btnSecondary, inputClass, labelClass, PageTitle } from "@/components/ui";
import type { Venue } from "@/types/database";

const NEW_VENUE = "__new__";

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
  const [venueChoice, setVenueChoice] = useState(NEW_VENUE);
  const [venueName, setVenueName] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [radiusMeters, setRadiusMeters] = useState("150");
  const [locating, setLocating] = useState(false);
  const [days, setDays] = useState<DayInput[]>([emptyDay()]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let ignore = false;
    fetch("/api/venues")
      .then((res) => res.json())
      .then((data) => {
        if (ignore || !data.venues?.length) return;
        setVenues(data.venues);
        setVenueChoice(data.venues[0].id);
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, []);

  function fillCurrentLocation() {
    setError(null);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toFixed(6));
        setLongitude(pos.coords.longitude.toFixed(6));
        setLocating(false);
      },
      () => {
        setError("Couldn't get your location. Allow location access, or type the coordinates.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 20000 }
    );
  }

  function addDay() {
    setDays((prev) => {
      const last = prev[prev.length - 1];
      // Continue from the previous day, keeping its window times.
      return [...prev, last?.dayDate ? withDate(last, nextDate(last.dayDate)) : emptyDay()];
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const payloads = [];
    for (const [i, day] of days.entries()) {
      const p = dayToPayload(day);
      if (!p.ok) {
        setError(days.length > 1 ? `Day ${i + 1}: ${p.message}` : p.message);
        return;
      }
      payloads.push(p.value);
    }

    let venue;
    if (venueChoice === NEW_VENUE) {
      const lat = Number(latitude);
      const lng = Number(longitude);
      if (!latitude || !longitude || Number.isNaN(lat) || Number.isNaN(lng)) {
        setError("Enter the venue's latitude and longitude, or use your current location.");
        return;
      }
      venue = { name: venueName, latitude: lat, longitude: lng, radiusMeters: Number(radiusMeters) };
    } else {
      venue = { venueId: venueChoice };
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, venue, days: payloads }),
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

  const selectedVenue = venues.find((v) => v.id === venueChoice);

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/officer" className="text-sm text-slate-500 hover:text-slate-900">
        ← Events
      </Link>
      <div className="mt-2">
        <PageTitle title="New event" subtitle="All times are Philippine time." />
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
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

        <fieldset className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <legend className="px-1 text-sm font-semibold text-slate-900">Venue</legend>
          {venues.length > 0 && (
            <select
              value={venueChoice}
              onChange={(e) => setVenueChoice(e.target.value)}
              className={inputClass}
              aria-label="Venue"
            >
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.radius_meters} m)
                </option>
              ))}
              <option value={NEW_VENUE}>+ New venue…</option>
            </select>
          )}

          {selectedVenue && (
            <p className="text-xs text-slate-500">
              Students must be within {selectedVenue.radius_meters} m of {selectedVenue.latitude.toFixed(5)},{" "}
              {selectedVenue.longitude.toFixed(5)}.
            </p>
          )}

          {venueChoice === NEW_VENUE && (
            <div className="space-y-3">
              <input
                required
                placeholder="Venue name (e.g. CMAT Covered Court)"
                value={venueName}
                onChange={(e) => setVenueName(e.target.value)}
                className={inputClass}
              />
              <div className="flex gap-3">
                <input
                  required
                  inputMode="decimal"
                  placeholder="Latitude"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  className={inputClass}
                />
                <input
                  required
                  inputMode="decimal"
                  placeholder="Longitude"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  Radius
                  <input
                    required
                    type="number"
                    min={20}
                    max={2000}
                    value={radiusMeters}
                    onChange={(e) => setRadiusMeters(e.target.value)}
                    className={`${inputClass} w-24`}
                  />
                  m
                </label>
                <button type="button" onClick={fillCurrentLocation} disabled={locating} className={btnSecondary}>
                  {locating ? "Locating..." : "📍 Use my current location"}
                </button>
              </div>
              <p className="text-xs text-slate-500">
                Stand at the center of the venue and use your location. GPS drifts indoors, so keep the radius
                generous (150 m or more for gyms and covered courts).
              </p>
            </div>
          )}
        </fieldset>

        <fieldset className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
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
              <DayWindowFields
                value={day}
                onChange={(next) => setDays((prev) => prev.map((d, idx) => (idx === i ? next : d)))}
              />
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
