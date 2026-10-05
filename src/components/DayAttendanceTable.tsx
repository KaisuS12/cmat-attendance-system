"use client";

import { useState } from "react";
import { formatTime } from "@/lib/datetime";
import type { DayAttendanceRow } from "@/lib/reports";
import { inputClass } from "@/components/ui";

function Time({ entry }: { entry: DayAttendanceRow["signIn"] }) {
  if (!entry) return <span className="text-slate-300">—</span>;
  return (
    <span title={entry.reason ?? undefined}>
      {formatTime(entry.at)}
      {entry.method === "manual" && (
        <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] font-medium text-amber-800">manual</span>
      )}
    </span>
  );
}

export function DayAttendanceTable({ rows }: { rows: DayAttendanceRow[] }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  if (rows.length === 0) {
    return <p className="mt-4 text-sm text-slate-400">No attendance recorded yet.</p>;
  }

  const q = query.trim().toLowerCase();
  const filtered = q
    ? rows.filter(
        (r) =>
          r.student.full_name.toLowerCase().includes(q) ||
          (r.student.student_id ?? "").toLowerCase().includes(q) ||
          [r.student.program, r.student.year_level, r.student.section].join(" ").toLowerCase().includes(q)
      )
    : rows;

  return (
    <div className="mt-4">
      <button onClick={() => setOpen((o) => !o)} className="text-sm font-medium text-slate-600 hover:text-slate-900">
        {open ? "▾ Hide" : "▸ Show"} attendance list ({rows.length})
      </button>

      {open && (
        <div className="mt-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, ID, program or section"
            className={inputClass}
          />
          <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[34rem] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">ID</th>
                  <th className="px-3 py-2">Program / Sec</th>
                  <th className="px-3 py-2">In</th>
                  <th className="px-3 py-2">Out</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r) => (
                  <tr key={r.student.id}>
                    <td className="px-3 py-2 font-medium text-slate-800">{r.student.full_name}</td>
                    <td className="px-3 py-2 text-slate-600">{r.student.student_id}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {[r.student.program, [r.student.year_level, r.student.section].filter(Boolean).join("-")]
                        .filter(Boolean)
                        .join(" ")}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      <Time entry={r.signIn} />
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      <Time entry={r.signOut} />
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-4 text-center text-slate-400">
                      No matches.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
