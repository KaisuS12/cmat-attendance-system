"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DayWindowFields, dayToPayload, emptyDay } from "@/components/DayWindowFields";
import { emptyVenue, SAME_VENUE, VenuePicker, venueToPayload } from "@/components/VenuePicker";
import { Alert, btnPrimary, btnSecondary } from "@/components/ui";
import type { Venue } from "@/types/database";

export function AddDayForm({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState(emptyDay);
  const [title, setTitle] = useState("");
  const [venue, setVenue] = useState(() => emptyVenue(SAME_VENUE));
  const [venues, setVenues] = useState<Venue[]>([]);

  // Saved venues for the picker, loaded when the form opens.
  useEffect(() => {
    if (!open) return;
    let ignore = false;
    fetch("/api/venues")
      .then((res) => res.json())
      .then((data) => {
        if (!ignore && data.venues) setVenues(data.venues);
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [open]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const payload = dayToPayload(day);
    if (!payload.ok) {
      setError(payload.message);
      return;
    }
    const dayVenue = venueToPayload(venue);
    if (!dayVenue.ok) {
      setError(dayVenue.message);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/events/${eventId}/days`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload.value,
          ...(title.trim() ? { title: title.trim() } : {}),
          ...(dayVenue.value ? { venue: dayVenue.value } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not add the day.");
        return;
      }
      setOpen(false);
      setDay(emptyDay());
      setTitle("");
      setVenue(emptyVenue(SAME_VENUE));
      router.refresh();
    } catch {
      setError("Network error — try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className={btnSecondary}>
        + Add another day
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-slate-200 border-t-4 border-t-gold-400 bg-white p-4 sm:p-5">
      <h2 className="font-semibold text-brand-800">Add a day</h2>
      <label htmlFor="add-day-title" className="block text-xs font-medium text-slate-500">
        Day title <span className="font-normal text-slate-400">(optional)</span>
        <input
          id="add-day-title"
          value={title}
          maxLength={80}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Field Day"
          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm"
        />
      </label>
      <DayWindowFields value={day} onChange={setDay} />
      <div>
        <p className="mb-1 text-xs font-medium text-slate-500">Venue for this day</p>
        <VenuePicker id="add-day-venue" venues={venues} value={venue} onChange={setVenue} allowSame />
      </div>
      {error && <Alert kind="error">{error}</Alert>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className={btnPrimary}>
          {saving ? "Adding..." : "Add day"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={btnSecondary}>
          Cancel
        </button>
      </div>
    </form>
  );
}
