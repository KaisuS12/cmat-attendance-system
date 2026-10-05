"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TargetPicker, type Targets } from "@/components/TargetPicker";
import { Alert, btnPrimary, btnSecondary, inputClass, labelClass } from "@/components/ui";
import type { EventRecord, Venue } from "@/types/database";

export function EditEventForm({ event }: { event: EventRecord }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description ?? "");
  const [venueId, setVenueId] = useState(event.venue_id);
  const [venues, setVenues] = useState<Venue[] | null>(null);
  const [targets, setTargets] = useState<Targets>({
    programs: event.target_programs ?? [],
    yearLevels: event.target_year_levels ?? [],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || venues) return;
    let ignore = false;
    fetch("/api/venues")
      .then((res) => (res.ok ? res.json() : { venues: [] }))
      .then((data) => {
        if (!ignore) setVenues(data.venues ?? []);
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [open, venues]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          venueId,
          targetPrograms: targets.programs,
          targetYearLevels: targets.yearLevels,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not save.");
        return;
      }
      setOpen(false);
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
        Edit event
      </button>
    );
  }

  // The venue list collapses duplicate venues, so the event's own venue row
  // may not be in it; it's then listed as "Current venue".
  const venueOptions = venues;

  return (
    <form onSubmit={handleSubmit} className="mt-4 w-full space-y-4 rounded-xl border border-slate-200 border-t-4 border-t-gold-400 bg-white p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-brand-800">Edit event</h2>
      <div>
        <label htmlFor="edit-title" className={labelClass}>
          Title
        </label>
        <input id="edit-title" required value={title} onChange={(e) => setTitle(e.target.value)} className={`${inputClass} mt-1`} />
      </div>
      <div>
        <label htmlFor="edit-description" className={labelClass}>
          Description
        </label>
        <textarea
          id="edit-description"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={`${inputClass} mt-1`}
        />
      </div>
      <div>
        <label htmlFor="edit-venue" className={labelClass}>
          Venue
        </label>
        <select
          id="edit-venue"
          value={venueId}
          onChange={(e) => setVenueId(e.target.value)}
          className={`${inputClass} mt-1`}
          disabled={!venueOptions}
        >
          {!venueOptions?.some((v) => v.id === event.venue_id) && <option value={event.venue_id}>Current venue</option>}
          {venueOptions?.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name} ({v.radius_meters} m)
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-400">To use a new location, create the event with a new venue.</p>
      </div>
      <div>
        <p className={labelClass}>Who should attend</p>
        <div className="mt-2">
          <TargetPicker value={targets} onChange={setTargets} />
        </div>
      </div>
      {error && <Alert kind="error">{error}</Alert>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className={btnPrimary}>
          {saving ? "Saving..." : "Save changes"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={btnSecondary}>
          Cancel
        </button>
      </div>
    </form>
  );
}
