"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Semester } from "@/types/database";

export default function SemestersPage() {
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [makeActive, setMakeActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/semesters");
    const data = await res.json();
    if (res.ok) setSemesters(data.semesters);
  }

  useEffect(() => {
    let ignore = false;
    fetch("/api/semesters")
      .then((res) => res.json())
      .then((data) => {
        if (!ignore) setSemesters(data.semesters ?? []);
      });
    return () => {
      ignore = true;
    };
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const res = await fetch("/api/semesters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, startDate, endDate, makeActive }),
    });
    const data = await res.json();

    setSaving(false);

    if (!res.ok) {
      setError(data.error ?? "Could not create semester.");
      return;
    }

    setName("");
    setStartDate("");
    setEndDate("");
    load();
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/admin" className="text-sm text-slate-500 hover:text-slate-900">
        ← Back
      </Link>
      <h1 className="mt-2 text-xl font-semibold text-slate-900">Semesters</h1>

      <form onSubmit={handleCreate} className="mt-6 space-y-3 rounded-xl border border-slate-200 bg-white p-5">
        <input
          required
          placeholder="e.g. AY 2026-2027, 1st Semester"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <div className="flex gap-3">
          <input
            required
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            required
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={makeActive} onChange={(e) => setMakeActive(e.target.checked)} />
          Set as active semester
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-md bg-slate-900 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "Saving..." : "Create semester"}
        </button>
      </form>

      <div className="mt-6 space-y-2">
        {semesters.map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 text-sm">
            <div>
              <p className="font-medium text-slate-800">{s.name}</p>
              <p className="text-xs text-slate-400">
                {s.start_date} – {s.end_date}
              </p>
            </div>
            {s.is_active && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                Active
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
