"use client";

import { useState } from "react";
import { formatDayDate } from "@/lib/datetime";

export interface TrendDatum {
  key: string;
  title: string;
  date: string;
  signedIn: number;
  expected: number;
  rate: number; // 0–1
}

const W = 600;
const H = 220;
const PAD = { top: 14, right: 16, bottom: 30, left: 46 };
const LINE = "#1e4a9c"; // brand-600
const GRID = "#e2e8f0"; // slate-200

const pct = (r: number) => `${Math.round(r * 100)}%`;

// Attendance rate per finished event day, in date order. Single series, so
// no legend: the card title names it. A vertical crosshair snaps to the
// nearest day; the same readout shows on keyboard focus.
export function TrendChart({ data }: { data: TrendDatum[] }) {
  const [active, setActive] = useState<number | null>(null);

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const step = data.length > 1 ? innerW / (data.length - 1) : 0;
  const x = (i: number) => (data.length > 1 ? PAD.left + i * step : PAD.left + innerW / 2);
  const y = (r: number) => PAD.top + (1 - r) * innerH;

  const line = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(d.rate)}`).join(" ");
  const area =
    data.length > 1 ? `${line} L${x(data.length - 1)},${y(0)} L${x(0)},${y(0)} Z` : "";

  // Hit columns: each day owns the band halfway to its neighbours.
  const band = (i: number) => {
    if (data.length === 1) return { x0: PAD.left, x1: W - PAD.right };
    const half = step / 2;
    return { x0: Math.max(PAD.left, x(i) - half), x1: Math.min(W - PAD.right, x(i) + half) };
  };

  const a = active !== null ? data[active] : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full overflow-visible"
        role="img"
        aria-label={`Attendance rate across ${data.length} event days`}
        onMouseLeave={() => setActive(null)}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
            <text x={PAD.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" className="fill-slate-500 text-[11px]">
              {pct(t)}
            </text>
          </g>
        ))}

        {area && <path d={area} fill={LINE} opacity={0.08} />}
        {data.length > 1 && <path d={line} fill="none" stroke={LINE} strokeWidth={2} strokeLinejoin="round" />}

        {a && active !== null && (
          <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={y(0)} stroke="#64748b" strokeWidth={1} strokeDasharray="3 3" />
        )}

        {data.map((d, i) => (
          <circle
            key={d.key}
            cx={x(i)}
            cy={y(d.rate)}
            r={active === i ? 6 : 4.5}
            fill={active === i ? LINE : "#fff"}
            stroke={LINE}
            strokeWidth={2}
          />
        ))}

        {/* First and last dates on the axis; every date is in the tooltip and table. */}
        {data.length > 0 && (
          <text x={x(0)} y={H - 8} textAnchor={data.length > 1 ? "start" : "middle"} className="fill-slate-500 text-[11px]">
            {formatDayDate(data[0].date, "numeric")}
          </text>
        )}
        {data.length > 1 && (
          <text x={x(data.length - 1)} y={H - 8} textAnchor="end" className="fill-slate-500 text-[11px]">
            {formatDayDate(data[data.length - 1].date, "numeric")}
          </text>
        )}

        {data.map((d, i) => {
          const { x0, x1 } = band(i);
          return (
            <rect
              key={`hit-${d.key}`}
              x={x0}
              y={PAD.top}
              width={Math.max(24, x1 - x0)}
              height={innerH}
              fill="transparent"
              tabIndex={0}
              aria-label={`${d.title}, ${formatDayDate(d.date, "numeric")}: ${pct(d.rate)}, ${d.signedIn} of ${d.expected} signed in`}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              onTouchStart={() => setActive(i)}
              className="cursor-pointer outline-none"
            />
          );
        })}
      </svg>

      {a && active !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 w-max max-w-[14rem] -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg"
          style={{ left: `${Math.min(88, Math.max(12, (x(active) / W) * 100))}%` }}
        >
          <p className="text-base font-bold text-slate-900">{pct(a.rate)}</p>
          <p className="text-slate-600">
            {a.signedIn} of {a.expected} signed in
          </p>
          <p className="mt-1 font-medium text-slate-800">{a.title}</p>
          <p className="text-slate-500">{formatDayDate(a.date, "numeric")}</p>
        </div>
      )}
    </div>
  );
}
