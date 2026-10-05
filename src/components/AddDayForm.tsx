"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DayWindowFields, dayToPayload, emptyDay } from "@/components/DayWindowFields";
import { Alert, btnPrimary, btnSecondary } from "@/components/ui";

export function AddDayForm({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState(emptyDay);
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

    setSaving(true);
    try {
      const res = await fetch(`/api/events/${eventId}/days`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload.value),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not add the day.");
        return;
      }
      setOpen(false);
      setDay(emptyDay());
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
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <h2 className="font-semibold text-slate-900">Add a day</h2>
      <DayWindowFields value={day} onChange={setDay} />
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
