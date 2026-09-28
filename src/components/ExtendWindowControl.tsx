"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ExtendWindowControl({
  eventId,
  dayId,
  field,
  currentValue,
}: {
  eventId: string;
  dayId: string;
  field: "signInEnd" | "signOutEnd";
  currentValue: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(currentValue.slice(0, 16));
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await fetch(`/api/events/${eventId}/days/${dayId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: new Date(value).toISOString() }),
    });
    setSaving(false);
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs font-medium text-slate-500 underline hover:text-slate-900">
        Extend
      </button>
    );
  }

  return (
    <div className="mt-1 flex items-center gap-2">
      <input
        type="datetime-local"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="rounded-md border border-slate-300 px-2 py-1 text-xs"
      />
      <button
        onClick={save}
        disabled={saving}
        className="rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
      >
        {saving ? "..." : "Save"}
      </button>
      <button onClick={() => setOpen(false)} className="text-xs text-slate-400">
        Cancel
      </button>
    </div>
  );
}
