"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, btnPrimary, inputClass } from "@/components/ui";

export function AddSemesterForm({ isFirst }: { isFirst: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [makeActive, setMakeActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/semesters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, startDate, endDate, makeActive }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not create semester.");
        return;
      }
      setName("");
      setStartDate("");
      setEndDate("");
      router.refresh();
    } catch {
      setError("Network error — try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleCreate} className="mt-6 space-y-3 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-slate-900">{isFirst ? "Create the first semester" : "Add semester"}</h2>
      <input
        required
        placeholder="e.g. AY 2026-2027, 1st Semester"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className={inputClass}
      />
      <div className="flex gap-3">
        <label className="flex-1 text-xs font-medium text-slate-500">
          Starts
          <input
            required
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={`${inputClass} mt-1`}
          />
        </label>
        <label className="flex-1 text-xs font-medium text-slate-500">
          Ends
          <input
            required
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className={`${inputClass} mt-1`}
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={makeActive} onChange={(e) => setMakeActive(e.target.checked)} />
        Set as the active semester
      </label>
      {error && <Alert kind="error">{error}</Alert>}
      <button type="submit" disabled={saving} className={`${btnPrimary} w-full`}>
        {saving ? "Saving..." : "Create semester"}
      </button>
    </form>
  );
}
