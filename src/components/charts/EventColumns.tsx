"use client";

import { useState } from "react";
import { formatDayDate } from "@/lib/datetime";
import { AXIS_TEXT, GRID, SERIES_BLUE, SERIES_GOLD } from "@/components/charts/colors";

export interface ColumnDatum {
  key: string;
  title: string;
  date: string;
  signedIn: number;
  complete: number;
  expected: number;
}

const W = 640;
const H = 240;
const PAD = { top: 16, right: 8, bottom: 34, left: 34 };

function niceMax(v: number) {
  if (v <= 5) return 5;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  return (n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

// Grouped columns per event day: "Signed in" (blue) next to "Completed"
// (gold, signed in and out). Hovering or focusing a day shows one tooltip
// with both values.
export function EventColumns({ data }: { data: ColumnDatum[] }) {
  const [active, setActive] = useState<number | null>(null);
  if (data.length === 0) return <p className="text-sm text-slate-500">No finished events yet.</p>;

  const max = niceMax(Math.max(1, ...data.map((d) => Math.max(d.signedIn, d.complete))));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const slot = innerW / data.length;
  const barW = Math.min(18, (slot - 10) / 2);
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  // Whole-number steps: 0–5 by 1, otherwise five equal steps of a nice max.
  const tickStep = max <= 5 ? 1 : max / 5;
  const ticks = Array.from({ length: Math.round(max / tickStep) + 1 }, (_, i) => i * tickStep);

  // A column path with a 4px rounded top, flat on the baseline.
  const bar = (x: number, v: number) => {
    const top = y(v);
    const h = PAD.top + innerH - top;
    if (h <= 0) return "";
    const r = Math.min(4, h, barW / 2);
    const base = PAD.top + innerH;
    return `M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${base} Z`;
  };

  const a = active !== null ? data[active] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Signed in and completed per event day" onMouseLeave={() => setActive(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke={GRID} />
            <text x={PAD.left - 6} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill={AXIS_TEXT}>
              {t}
            </text>
          </g>
        ))}

        {data.map((d, i) => {
          const cx = PAD.left + slot * i + slot / 2;
          const x1 = cx - barW - 1; // 2px surface gap between the pair
          const x2 = cx + 1;
          return (
            <g key={d.key} opacity={active === null || active === i ? 1 : 0.45}>
              {active === i && <rect x={PAD.left + slot * i} y={PAD.top} width={slot} height={innerH} fill="#f1f5f9" />}
              <path d={bar(x1, d.signedIn)} fill={SERIES_BLUE} />
              <path d={bar(x2, d.complete)} fill={SERIES_GOLD} />
              <text x={cx} y={H - 14} textAnchor="middle" fontSize={11} fill={AXIS_TEXT}>
                {formatDayDate(d.date, "short").replace(/^\w+, /, "")}
              </text>
              <rect
                x={PAD.left + slot * i}
                y={PAD.top}
                width={slot}
                height={innerH + 20}
                fill="transparent"
                tabIndex={0}
                aria-label={`${d.title}, ${formatDayDate(d.date, "numeric")}: ${d.signedIn} signed in, ${d.complete} completed of ${d.expected} expected`}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                onTouchStart={() => setActive(i)}
                className="cursor-pointer outline-none"
              />
            </g>
          );
        })}
      </svg>

      {a && active !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 w-max max-w-[15rem] -translate-x-1/2 rounded-lg bg-brand-800 px-3 py-2 text-xs text-white shadow-lg"
          style={{ left: `${Math.min(85, Math.max(15, ((PAD.left + slot * active + slot / 2) / W) * 100))}%` }}
        >
          <p className="font-semibold">{a.title}</p>
          <p className="text-brand-100">{formatDayDate(a.date, "numeric")}</p>
          <p className="mt-1 flex items-center gap-2">
            <span className="h-0.5 w-3" style={{ background: "#9fbcf0" }} aria-hidden="true" />
            <span className="font-bold">{a.signedIn}</span> signed in
          </p>
          <p className="flex items-center gap-2">
            <span className="h-0.5 w-3" style={{ background: "#f3d36b" }} aria-hidden="true" />
            <span className="font-bold">{a.complete}</span> completed
          </p>
          <p className="text-brand-100">of {a.expected} expected</p>
        </div>
      )}
    </div>
  );
}
