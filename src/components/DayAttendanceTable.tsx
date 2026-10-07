"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatTime } from "@/lib/datetime";
import type { AttendanceEntry, DayAttendanceRow, SectionStat, StudentSummary } from "@/lib/reports";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { inputClass } from "@/components/ui";

function groupLabel(s: StudentSummary) {
  return [s.program, s.year_level].filter(Boolean).join(" ");
}

function matchesQuery(s: StudentSummary, q: string) {
  return (
    s.full_name.toLowerCase().includes(q) ||
    (s.student_id ?? "").toLowerCase().includes(q) ||
    groupLabel(s).toLowerCase().includes(q)
  );
}

type Tab = "attendance" | "missing" | "sections";

interface VoidTarget {
  entry: AttendanceEntry;
  name: string;
  type: "sign-in" | "sign-out";
}

// Per-day attendance detail on the officer event page: who's recorded (with
// a void action for admins), who's still missing, and a per-program/year summary.
export function DayAttendanceTable({
  rows,
  missing,
  sections,
  canVoid,
}: {
  rows: DayAttendanceRow[];
  missing: StudentSummary[];
  sections: SectionStat[];
  canVoid: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("attendance");
  const [query, setQuery] = useState("");
  const [voidTarget, setVoidTarget] = useState<VoidTarget | null>(null);
  const [voiding, setVoiding] = useState(false);
  const [voidError, setVoidError] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const shownRows = q ? rows.filter((r) => matchesQuery(r.student, q)) : rows;
  const shownMissing = q ? missing.filter((s) => matchesQuery(s, q)) : missing;

  async function confirmVoid(reason: string) {
    if (!voidTarget) return;
    setVoiding(true);
    setVoidError(null);
    try {
      const res = await fetch(`/api/attendance/${voidTarget.entry.id}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setVoidError(data.error ?? "Could not void the record.");
        return;
      }
      setVoidTarget(null);
      router.refresh();
    } catch {
      setVoidError("Network error — try again.");
    } finally {
      setVoiding(false);
    }
  }

  function renderEntry(entry: AttendanceEntry | null, name: string, type: VoidTarget["type"]) {
    if (!entry) return <span className="text-slate-300">—</span>;
    return (
      <span className="inline-flex flex-wrap items-center gap-1" title={entry.reason ?? undefined}>
        {formatTime(entry.at)}
        {entry.method === "manual" && (
          <span className="rounded bg-amber-100 px-1 text-[10px] font-medium text-amber-800">manual</span>
        )}
        {canVoid && (
          <button
            onClick={() => {
              setVoidError(null);
              setVoidTarget({ entry, name, type });
            }}
            className="text-[11px] font-medium text-red-600 underline"
          >
            void
          </button>
        )}
      </span>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "attendance", label: `Recorded (${rows.length})` },
    { key: "missing", label: `Missing (${missing.length})` },
    { key: "sections", label: "By program & year" },
  ];

  return (
    <div className="mt-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="min-h-11 text-sm font-medium text-slate-600 hover:text-slate-900"
        aria-expanded={open}
      >
        {open ? "▾ Hide" : "▸ Show"} details
      </button>

      {open && (
        <div className="mt-2">
          <div className="flex gap-1 overflow-x-auto rounded-lg bg-brand-50 p-1 text-sm" role="tablist">
            {tabs.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={`min-h-9 flex-1 whitespace-nowrap rounded-md px-3 font-medium transition ${
                  tab === t.key ? "bg-white font-semibold text-brand-800 shadow-sm ring-1 ring-gold-400" : "text-slate-500"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab !== "sections" && (
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, ID or program"
              className={`${inputClass} mt-3`}
            />
          )}

          {tab === "attendance" &&
            (shownRows.length === 0 ? (
              <p className="mt-4 text-sm text-slate-400">{rows.length === 0 ? "No attendance recorded yet." : "No matches."}</p>
            ) : (
              <>
                <ul className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200 sm:hidden">
                  {shownRows.map((r) => (
                    <li key={r.student.id} className="px-3 py-2.5 text-sm">
                      <p className="font-medium text-slate-800">{r.student.full_name}</p>
                      <p className="text-xs text-slate-500">
                        {r.student.student_id} · {groupLabel(r.student)}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                        <span>
                          In {renderEntry(r.signIn, r.student.full_name, "sign-in")}
                        </span>
                        <span>
                          Out {renderEntry(r.signOut, r.student.full_name, "sign-out")}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 hidden overflow-x-auto rounded-lg border border-slate-200 sm:block">
                  <table className="w-full text-sm">
                    <thead className="bg-gold-100 text-left text-xs uppercase tracking-wide text-gold-600">
                      <tr>
                        <th className="px-3 py-2">Name</th>
                        <th className="px-3 py-2">ID</th>
                        <th className="px-3 py-2">Program / Sec</th>
                        <th className="px-3 py-2">In</th>
                        <th className="px-3 py-2">Out</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {shownRows.map((r) => (
                        <tr key={r.student.id}>
                          <td className="px-3 py-2 font-medium text-slate-800">{r.student.full_name}</td>
                          <td className="px-3 py-2 text-slate-600">{r.student.student_id}</td>
                          <td className="px-3 py-2 text-slate-600">{groupLabel(r.student)}</td>
                          <td className="px-3 py-2 text-slate-600">
                            {renderEntry(r.signIn, r.student.full_name, "sign-in")}
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {renderEntry(r.signOut, r.student.full_name, "sign-out")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ))}

          {tab === "missing" &&
            (shownMissing.length === 0 ? (
              <p className="mt-4 text-sm text-slate-400">
                {missing.length === 0 ? "Everyone expected has signed in." : "No matches."}
              </p>
            ) : (
              <ul className="mt-3 max-h-[28rem] divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
                {shownMissing.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-baseline justify-between gap-x-3 px-3 py-2 text-sm">
                    <span className="font-medium text-slate-800">{s.full_name}</span>
                    <span className="text-xs text-slate-500">
                      {s.student_id} · {groupLabel(s)}
                    </span>
                  </li>
                ))}
              </ul>
            ))}

          {tab === "sections" &&
            (sections.length === 0 ? (
              <p className="mt-4 text-sm text-slate-400">No students expected.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {sections.map((s) => {
                  const pct = s.expected > 0 ? Math.round((s.signedIn / s.expected) * 100) : 0;
                  return (
                    <li key={s.label} className="rounded-lg border border-slate-200 px-3 py-2">
                      <div className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="font-medium text-slate-800">{s.label}</span>
                        <span className="tabular-nums text-slate-600">
                          {s.signedIn}/{s.expected} · <span className="font-semibold text-slate-900">{pct}%</span>
                        </span>
                      </div>
                      <div
                        className="mt-1.5 h-2 overflow-hidden rounded-full bg-brand-50"
                        role="img"
                        aria-label={`${pct}% signed in`}
                      >
                        <div className="h-full rounded-full bg-brand-600" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            ))}
        </div>
      )}

      <ConfirmDialog
        open={voidTarget !== null}
        title="Void this record?"
        message={
          voidTarget && (
            <>
              This removes <strong>{voidTarget.name}</strong>&apos;s {voidTarget.type} from every count. The record is
              kept in the audit log, and the correct one can be scanned or entered again.
            </>
          )
        }
        reasonLabel="Reason"
        confirmLabel="Void record"
        danger
        busy={voiding}
        error={voidError}
        onConfirm={confirmVoid}
        onCancel={() => setVoidTarget(null)}
      />
    </div>
  );
}
