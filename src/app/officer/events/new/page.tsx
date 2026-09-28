"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface DayInput {
  dayDate: string;
  signInStart: string;
  signInEnd: string;
  signOutStart: string;
  signOutEnd: string;
}

function emptyDay(): DayInput {
  return { dayDate: "", signInStart: "", signInEnd: "", signOutStart: "", signOutEnd: "" };
}

export default function NewEventPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [venueName, setVenueName] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [radiusMeters, setRadiusMeters] = useState("150");
  const [days, setDays] = useState<DayInput[]>([emptyDay()]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function updateDay(index: number, field: keyof DayInput, value: string) {
    setDays((prev) => prev.map((d, i) => (i === index ? { ...d, [field]: value } : d)));
  }

  function useCurrentLocation() {
    navigator.geolocation.getCurrentPosition((pos) => {
      setLatitude(String(pos.coords.latitude));
      setLongitude(String(pos.coords.longitude));
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        venue: {
          name: venueName,
          latitude: Number(latitude),
          longitude: Number(longitude),
          radiusMeters: Number(radiusMeters),
        },
        days: days.map((d) => ({
          dayDate: d.dayDate,
          signInStart: new Date(d.signInStart).toISOString(),
          signInEnd: new Date(d.signInEnd).toISOString(),
          signOutStart: new Date(d.signOutStart).toISOString(),
          signOutEnd: new Date(d.signOutEnd).toISOString(),
        })),
      }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Could not create event.");
      return;
    }

    router.push("/officer");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/officer" className="text-sm text-slate-500 hover:text-slate-900">
        ← Back
      </Link>
      <h1 className="mt-2 text-xl font-semibold text-slate-900">New Event</h1>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-700">Title</label>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <fieldset className="rounded-lg border border-slate-200 p-4">
          <legend className="px-1 text-sm font-medium text-slate-700">Venue</legend>
          <div className="space-y-3">
            <input
              required
              placeholder="Venue name (e.g. CMAT Covered Court)"
              value={venueName}
              onChange={(e) => setVenueName(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="flex gap-3">
              <input
                required
                placeholder="Latitude"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                required
                placeholder="Longitude"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex items-center gap-3">
              <input
                required
                type="number"
                placeholder="Radius (meters)"
                value={radiusMeters}
                onChange={(e) => setRadiusMeters(e.target.value)}
                className="w-40 rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={useCurrentLocation}
                className="text-sm font-medium text-slate-600 underline hover:text-slate-900"
              >
                Use my current location
              </button>
            </div>
          </div>
        </fieldset>

        <fieldset className="rounded-lg border border-slate-200 p-4">
          <legend className="px-1 text-sm font-medium text-slate-700">Days</legend>
          <div className="space-y-4">
            {days.map((day, i) => (
              <div key={i} className="rounded-md bg-slate-50 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-600">Day {i + 1}</span>
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
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className="col-span-2 text-xs text-slate-500">
                    Date
                    <input
                      required
                      type="date"
                      value={day.dayDate}
                      onChange={(e) => updateDay(i, "dayDate", e.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                    />
                  </label>
                  <label className="text-xs text-slate-500">
                    Sign-in start
                    <input
                      required
                      type="datetime-local"
                      value={day.signInStart}
                      onChange={(e) => updateDay(i, "signInStart", e.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                    />
                  </label>
                  <label className="text-xs text-slate-500">
                    Sign-in end
                    <input
                      required
                      type="datetime-local"
                      value={day.signInEnd}
                      onChange={(e) => updateDay(i, "signInEnd", e.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                    />
                  </label>
                  <label className="text-xs text-slate-500">
                    Sign-out start
                    <input
                      required
                      type="datetime-local"
                      value={day.signOutStart}
                      onChange={(e) => updateDay(i, "signOutStart", e.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                    />
                  </label>
                  <label className="text-xs text-slate-500">
                    Sign-out end
                    <input
                      required
                      type="datetime-local"
                      value={day.signOutEnd}
                      onChange={(e) => updateDay(i, "signOutEnd", e.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                    />
                  </label>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setDays((prev) => [...prev, emptyDay()])}
              className="text-sm font-medium text-slate-600 underline hover:text-slate-900"
            >
              + Add another day
            </button>
          </div>
        </fieldset>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-slate-900 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {submitting ? "Creating..." : "Create event"}
        </button>
      </form>
    </div>
  );
}
