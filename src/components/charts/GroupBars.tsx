"use client";

import { useState } from "react";

export interface GroupDatum {
  label: string;
  signedIn: number;
  expected: number;
  rate: number; // 0–1
}

const pct = (r: number) => `${Math.round(r * 100)}%`;

// Attendance rate per group (program or year level): horizontal bars in one
// hue, sorted high to low, value at the bar's end. Hovering or focusing a
// bar shows the counts behind the percentage.
export function GroupBars({ data, title }: { data: GroupDatum[]; title: string }) {
  const [active, setActive] = useState<number | null>(null);

  if (data.length === 0) return <p className="text-sm text-slate-500">No data yet.</p>;

  return (
    <ul className="space-y-2" aria-label={title} onMouseLeave={() => setActive(null)}>
      {data.map((d, i) => (
        <li key={d.label} className="relative">
          <div
            tabIndex={0}
            role="img"
            aria-label={`${d.label}: ${pct(d.rate)}, ${d.signedIn} of ${d.expected} expected sign-ins`}
            onMouseEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
            onTouchStart={() => setActive(i)}
            className="grid cursor-default grid-cols-[minmax(4.5rem,7rem)_1fr_2.75rem] items-center gap-2 rounded-md py-1 outline-none focus-visible:ring-2 focus-visible:ring-gold-300"
          >
            <span className="truncate text-sm text-slate-700" title={d.label}>
              {d.label}
            </span>
            <span className="relative h-3">
              <span
                className={`absolute inset-y-0 left-0 rounded-r-[4px] transition-[filter] ${active === i ? "brightness-125" : ""}`}
                style={{ width: d.rate > 0 ? `max(3px, ${d.rate * 100}%)` : 0, background: "#1e4a9c" }}
              />
            </span>
            <span className="text-right text-sm font-semibold text-slate-900">{pct(d.rate)}</span>
          </div>
          {active === i && (
            <div className="pointer-events-none absolute right-12 -top-8 z-10 w-max rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs shadow-lg">
              <span className="font-bold text-slate-900">{d.signedIn}</span>
              <span className="text-slate-600"> of {d.expected} expected sign-ins</span>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
