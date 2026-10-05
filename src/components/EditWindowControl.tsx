"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { isoToLocalInput } from "@/lib/datetime";
import { DayWindowFields, dayToPayload, type DayInput } from "@/components/DayWindowFields";
import { Alert, btnPrimary, btnSecondary } from "@/components/ui";
import type { EventDay } from "@/types/database";

function toInput(day: EventDay): DayInput {
  return {
    dayDate: day.day_date,
    signInStart: isoToLocalInput(day.sign_in_start),
    signInEnd: isoToLocalInput(day.sign_in_end),
    signOutStart: isoToLocalInput(day.sign_out_start),
    signOutEnd: isoToLocalInput(day.sign_out_end),
  };
}

// Adds `minutes` to a datetime-local string without going through the
// browser's timezone (the value is Manila wall-clock time).
function addMinutes(local: string, minutes: number): string {
  const d = new Date(`${local}:00Z`);
  d.setUTCMinutes(d.getUTCMinutes() + minutes);
  return d.toISOString().slice(0, 16);
}

// Edit a day's windows. Quick "+15 min" buttons cover the common mid-event
// case (§4.1: extend sign-in by 15 minutes); the full editor covers the rest.
export function EditWindowControl({ eventId, day }: { eventId: string; day: EventDay }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<DayInput>(() => toInput(day));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(next: DayInput) {
    setError(null);
    const payload = dayToPayload(next);
    if (!payload.ok) {
      setError(payload.message);
      return;
    }
    const { signInStart, signInEnd, signOutStart, signOutEnd } = payload.value;

    setSaving(true);
    try {
      const res = await fetch(`/api/events/${eventId}/days/${day.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signInStart, signInEnd, signOutStart, signOutEnd }),
      });
      const data = await res.json();
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

  function extend(field: "signInEnd" | "signOutEnd") {
    const current = toInput(day);
    save({ ...current, [field]: addMinutes(current[field], 15) });
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => extend("signInEnd")} disabled={saving} className={`${btnSecondary} px-2.5 py-1 text-xs`}>
          Sign-in +15 min
        </button>
        <button onClick={() => extend("signOutEnd")} disabled={saving} className={`${btnSecondary} px-2.5 py-1 text-xs`}>
          Sign-out +15 min
        </button>
        <button
          onClick={() => {
            setValue(toInput(day));
            setOpen(true);
          }}
          className="text-xs font-medium text-slate-500 underline hover:text-slate-900"
        >
          Edit times
        </button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 p-3">
      <DayWindowFields value={value} onChange={setValue} showDate={false} />
      {error && <Alert kind="error">{error}</Alert>}
      <div className="flex gap-2">
        <button onClick={() => save(value)} disabled={saving} className={`${btnPrimary} px-3 py-1.5 text-xs`}>
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className={`${btnSecondary} px-3 py-1.5 text-xs`}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
