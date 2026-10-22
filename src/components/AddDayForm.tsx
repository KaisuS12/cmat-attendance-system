"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DayCard, dayCardToPayloads, emptyDayCard } from "@/components/DayCard";
import { Alert, btnPrimary, btnSecondary } from "@/components/ui";
import type { Venue } from "@/types/database";

export function AddDayForm({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState(emptyDayCard);
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
    if (!day.dayDate) {
      setError("Pick a date.");
      return;
    }
    const payloads = dayCardToPayloads(day, "");
    if (!payloads.ok) {
      setError(payloads.message);
      return;
    }

    setSaving(true);
    try {
      // One request per session (e.g. Morning, then Afternoon).
      for (const payload of payloads.value) {
        const res = await fetch(`/api/events/${eventId}/days`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Could not add the day.");
          router.refresh();
          return;
        }
      }
      setOpen(false);
      setDay(emptyDayCard());
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
      <DayCard id="add-day" value={day} onChange={setDay} venues={venues} titlePlaceholder="e.g. Field Day" />
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
