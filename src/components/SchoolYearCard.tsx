"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, btnPrimary, btnSecondary, cardClass, inputClass } from "@/components/ui";

interface ProgramRow {
  program: string;
  students: number;
  years: number;
}

interface Preview {
  promoted: number;
  graduating: number;
  skipped: { id: string; name: string; studentId: string | null; program: string | null; yearLevel: string | null }[];
  byProgram: { program: string; years: number; promoted: number; graduating: number }[];
}

export interface RecentPromotion {
  id: string;
  createdAt: string;
  promoted: number;
  graduating: number;
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}

// "New school year": move every student up a year, graduate those who
// finished their program, with a preview first and an undo for 24 hours.
export function SchoolYearCard({
  semesters,
  recent,
}: {
  semesters: { id: string; name: string; is_active: boolean }[];
  recent: RecentPromotion | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [programs, setPrograms] = useState<ProgramRow[] | null>(null);
  const [savedYears, setSavedYears] = useState<Record<string, number>>({});
  const [lastSemesterId, setLastSemesterId] = useState(
    semesters.find((s) => s.is_active)?.id ?? semesters[0]?.id ?? ""
  );
  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<RecentPromotion | null>(null);
  const [undoneCount, setUndoneCount] = useState<number | null>(null);

  // After an undo, the server-provided `recent` is stale until the refresh lands.
  const undoable = done ?? (undoneCount === null ? recent : null);
  const yearsChanged = programs?.some((p) => savedYears[p.program] !== p.years) ?? false;

  async function start() {
    setOpen(true);
    setError(null);
    setBusy("load");
    try {
      const data = await api<{ programs: ProgramRow[] }>("/api/program-settings");
      setPrograms(data.programs);
      setSavedYears(Object.fromEntries(data.programs.map((p) => [p.program, p.years])));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load programs.");
    } finally {
      setBusy(null);
    }
  }

  async function saveYears() {
    if (!programs) return;
    setBusy("save");
    setError(null);
    try {
      const data = await api<{ programs: ProgramRow[] }>("/api/program-settings", {
        method: "PUT",
        body: JSON.stringify({ programs: programs.map(({ program, years }) => ({ program, years })) }),
      });
      setPrograms(data.programs);
      setSavedYears(Object.fromEntries(data.programs.map((p) => [p.program, p.years])));
      setPreview(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(null);
    }
  }

  async function loadPreview() {
    setBusy("preview");
    setError(null);
    setConfirmed(false);
    try {
      setPreview(await api<Preview>("/api/school-year"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not preview.");
    } finally {
      setBusy(null);
    }
  }

  async function promote() {
    if (!preview) return;
    setBusy("promote");
    setError(null);
    try {
      const data = await api<{ id: string; promoted: number; graduating: number }>("/api/school-year", {
        method: "POST",
        body: JSON.stringify({
          expected: { promoted: preview.promoted, graduating: preview.graduating },
          lastSemesterId: lastSemesterId || null,
        }),
      });
      setDone({ id: data.id, createdAt: new Date().toISOString(), promoted: data.promoted, graduating: data.graduating });
      setPreview(null);
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not move students up.");
    } finally {
      setBusy(null);
    }
  }

  async function undo(id: string) {
    setBusy("undo");
    setError(null);
    try {
      const data = await api<{ restored: number }>(`/api/school-year/${id}/undo`, { method: "POST" });
      setDone(null);
      setUndoneCount(data.restored);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not undo.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className={`${cardClass} mt-6`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold text-brand-800">New school year</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Moves every student up a year (1st → 2nd, …) and marks those who finished their program as graduated.
            Graduates can still log in to see their history. Past semesters keep their old class lists, so old
            reports don&apos;t change.
          </p>
        </div>
        {!open && (
          <button onClick={start} className={btnSecondary} disabled={busy !== null}>
            Start
          </button>
        )}
      </div>

      {undoable && !open && (
        <div className="mt-4">
          <Alert kind="success">
            New school year started: {undoable.promoted} moved up, {undoable.graduating} graduated.{" "}
            <button
              onClick={() => undo(undoable.id)}
              disabled={busy !== null}
              className="font-semibold underline disabled:opacity-50"
            >
              {busy === "undo" ? "Undoing…" : "Undo"}
            </button>{" "}
            <span className="text-xs">(available for 24 hours)</span>
          </Alert>
        </div>
      )}
      {undoneCount !== null && !undoable && (
        <div className="mt-4">
          <Alert kind="info">Undone. {undoneCount} students are back to their previous year.</Alert>
        </div>
      )}

      {open && (
        <div className="mt-5 space-y-5">
          {/* Step 1 */}
          <div>
            <h3 className="text-sm font-semibold text-slate-800">1. How many years does each program run?</h3>
            <p className="text-xs text-slate-500">Students in the last year of their program graduate.</p>
            {busy === "load" && <p className="mt-2 text-sm text-slate-500">Loading programs…</p>}
            {programs && programs.length === 0 && <p className="mt-2 text-sm text-slate-500">No students yet.</p>}
            {programs && programs.length > 0 && (
              <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-gold-100 text-left text-xs uppercase tracking-wide text-gold-600">
                    <tr>
                      <th className="px-3 py-2">Program</th>
                      <th className="px-3 py-2 text-right">Students</th>
                      <th className="px-3 py-2 text-right">Years</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {programs.map((p, i) => (
                      <tr key={p.program}>
                        <td className="px-3 py-1.5 font-medium text-slate-800">{p.program}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-slate-600">{p.students}</td>
                        <td className="px-3 py-1.5 text-right">
                          <select
                            id={`years-${p.program}`}
                            aria-label={`Years in ${p.program}`}
                            value={p.years}
                            onChange={(e) =>
                              setPrograms((prev) =>
                                prev!.map((row, j) => (j === i ? { ...row, years: Number(e.target.value) } : row))
                              )
                            }
                            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
                          >
                            {[1, 2, 3, 4, 5, 6].map((n) => (
                              <option key={n} value={n}>
                                {n} years
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {yearsChanged && (
              <button onClick={saveYears} disabled={busy !== null} className={`${btnPrimary} mt-2 px-3 py-1.5 text-xs`}>
                {busy === "save" ? "Saving…" : "Save program lengths"}
              </button>
            )}
          </div>

          {/* Step 2 */}
          {semesters.length > 0 && (
            <label className="block">
              <span className="text-sm font-semibold text-slate-800">2. The school year that&apos;s ending ends with</span>
              <span className="block text-xs text-slate-500">
                This semester and the ones before it keep their class lists as they are now.
              </span>
              <select
                id="last-semester"
                value={lastSemesterId}
                onChange={(e) => setLastSemesterId(e.target.value)}
                className={`${inputClass} mt-1`}
              >
                {semesters.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.is_active ? " (active)" : ""}
                  </option>
                ))}
              </select>
            </label>
          )}

          {/* Step 3 */}
          <div>
            <h3 className="text-sm font-semibold text-slate-800">3. Preview</h3>
            <button
              onClick={loadPreview}
              disabled={busy !== null || yearsChanged || !programs}
              className={`${btnSecondary} mt-2`}
            >
              {busy === "preview" ? "Checking…" : preview ? "Preview again" : "Preview changes"}
            </button>
            {yearsChanged && <p className="mt-1 text-xs text-amber-700">Save the program lengths first.</p>}

            {preview && (
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-emerald-50 p-3">
                    <p className="text-2xl font-semibold tabular-nums text-emerald-700">{preview.promoted}</p>
                    <p className="text-xs uppercase tracking-wide text-emerald-700">Move up a year</p>
                  </div>
                  <div className="rounded-lg bg-gold-100 p-3">
                    <p className="text-2xl font-semibold tabular-nums text-gold-600">{preview.graduating}</p>
                    <p className="text-xs uppercase tracking-wide text-gold-600">Graduate</p>
                  </div>
                  <div className={`rounded-lg p-3 ${preview.skipped.length ? "bg-amber-50" : "bg-slate-50"}`}>
                    <p className={`text-2xl font-semibold tabular-nums ${preview.skipped.length ? "text-amber-700" : "text-slate-400"}`}>
                      {preview.skipped.length}
                    </p>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Skipped</p>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Program</th>
                        <th className="px-3 py-2 text-right">Move up</th>
                        <th className="px-3 py-2 text-right">Graduate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {preview.byProgram.map((p) => (
                        <tr key={p.program}>
                          <td className="px-3 py-1.5 text-slate-800">
                            {p.program} <span className="text-xs text-slate-400">· {p.years} years</span>
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{p.promoted}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{p.graduating}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {preview.skipped.length > 0 && (
                  <details className="rounded-lg border border-amber-200 p-3 text-sm">
                    <summary className="cursor-pointer font-medium text-amber-800">
                      {preview.skipped.length} skipped: their year isn&apos;t a number. Fix them by hand afterwards.
                    </summary>
                    <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-slate-600">
                      {preview.skipped.map((s) => (
                        <li key={s.id}>
                          {s.name} · {s.studentId} · {[s.program, s.yearLevel || "no year"].filter(Boolean).join(" ")}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )}
          </div>

          {/* Step 4 */}
          {preview && preview.promoted + preview.graduating > 0 && (
            <div className="space-y-3 border-t border-slate-100 pt-4">
              <label className="flex items-start gap-2 text-sm text-slate-600">
                <input
                  id="confirm-school-year"
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="mt-0.5 h-4 w-4"
                />
                Move {preview.promoted} students up a year and mark {preview.graduating} as graduated. Do this once,
                at the start of the new school year.
              </label>
              <div className="flex flex-wrap gap-2">
                <button onClick={promote} disabled={!confirmed || busy !== null} className={btnPrimary}>
                  {busy === "promote" ? "Working…" : "Start new school year"}
                </button>
                <button onClick={() => { setOpen(false); setPreview(null); }} className={btnSecondary}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mt-4">
          <Alert kind="error">{error}</Alert>
        </div>
      )}
    </section>
  );
}
