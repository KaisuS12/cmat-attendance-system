"use client";

import { useState } from "react";
import { formatDayDate } from "@/lib/datetime";
import { AXIS_TEXT, GRID, SERIES_BLUE, SERIES_GOLD } from "@/components/charts/colors";

export interface WaveDatum {
  key: string;
  title: string;
  date: string;
  rate: number; // signed in / expected
  completeRate: number; // completed / expected
}

const W = 640;
const H = 220;
const PAD = { top: 14, right: 12, bottom: 28, left: 46 };

type Pt = [number, number];

// Monotone cubic (Fritsch–Carlson): smooth like the reference "waves" but
// never overshoots the data, so a curve can't dip below 0% or above 100%.
function smooth(pts: Pt[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M${pts[0][0]},${pts[0][1]}`;
  const n = pts.length;
  const s: number[] = [];
  for (let i = 0; i < n - 1; i++) s.push((pts[i + 1][1] - pts[i][1]) / (pts[i + 1][0] - pts[i][0]));
  const t: number[] = new Array(n);
  t[0] = s[0];
  t[n - 1] = s[n - 2];
  for (let i = 1; i < n - 1; i++) t[i] = s[i - 1] * s[i] <= 0 ? 0 : (s[i - 1] + s[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (s[i] === 0) {
      t[i] = 0;
      t[i + 1] = 0;
      continue;
    }
    const a = t[i] / s[i];
    const b = t[i + 1] / s[i];
    const h = a * a + b * b;
    if (h > 9) {
      const k = 3 / Math.sqrt(h);
      t[i] = k * a * s[i];
      t[i + 1] = k * b * s[i];
    }
  }
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const dx = (pts[i + 1][0] - pts[i][0]) / 3;
    d += ` C${pts[i][0] + dx},${pts[i][1] + t[i] * dx} ${pts[i + 1][0] - dx},${pts[i + 1][1] - t[i + 1] * dx} ${pts[i + 1][0]},${pts[i + 1][1]}`;
  }
  return d;
}

const pct = (r: number) => `${Math.round(r * 100)}%`;

// Attendance trend as layered waves: sign-in rate behind, completion rate in
// front. The crosshair snaps to the nearest day and one tooltip lists both.
export function WaveChart({ data }: { data: WaveDatum[] }) {
  const [active, setActive] = useState<number | null>(null);
  if (data.length === 0) return <p className="text-sm text-slate-500">No finished events yet.</p>;

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const step = data.length > 1 ? innerW / (data.length - 1) : 0;
  const x = (i: number) => (data.length > 1 ? PAD.left + i * step : PAD.left + innerW / 2);
  const y = (r: number) => PAD.top + (1 - r) * innerH;
  const base = y(0);

  // Solid light tints (not transparency) so the layered areas never blend
  // into a muddy mix; "completed" is always within "signed in", so it sits in
  // front.
  const series = [
    { key: "rate" as const, color: SERIES_BLUE, tint: "#dbe5f7", label: "Signed in" },
    { key: "completeRate" as const, color: SERIES_GOLD, tint: "#f3e3ad", label: "Completed" },
  ];

  const paths = series.map((sr) => {
    const pts: Pt[] = data.map((d, i) => [x(i), y(d[sr.key])]);
    const line = smooth(pts);
    const area = pts.length > 1 ? `${line} L${pts[pts.length - 1][0]},${base} L${pts[0][0]},${base} Z` : "";
    return { ...sr, line, area };
  });

  const band = (i: number) =>
    data.length === 1
      ? { x0: PAD.left, w: innerW }
      : { x0: Math.max(PAD.left, x(i) - step / 2), w: Math.max(24, Math.min(step, i === 0 || i === data.length - 1 ? step / 2 : step)) };

  const a = active !== null ? data[active] : null;

  return (
    <div className="relative">
      <div className="mb-2 flex flex-wrap gap-4 text-xs text-slate-600">
        {series.map((sr) => (
          <span key={sr.key} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: sr.color }} aria-hidden="true" />
            {sr.label}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Attendance trend: sign-in rate and completion rate per event day" onMouseLeave={() => setActive(null)}>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke={GRID} />
            <text x={PAD.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill={AXIS_TEXT}>
              {pct(t)}
            </text>
          </g>
        ))}

        {paths.map((p) => (
          <g key={p.key}>
            {p.area && <path d={p.area} fill={p.tint} />}
            {data.length > 1 && <path d={p.line} fill="none" stroke={p.color} strokeWidth={2} strokeLinejoin="round" />}
          </g>
        ))}

        {a && active !== null && (
          <>
            <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={base} stroke={AXIS_TEXT} strokeDasharray="3 3" />
            {series.map((sr) => (
              <circle key={sr.key} cx={x(active)} cy={y(a[sr.key])} r={5} fill={sr.color} stroke="#fff" strokeWidth={2} />
            ))}
          </>
        )}

        <text x={x(0)} y={H - 8} textAnchor={data.length > 1 ? "start" : "middle"} fontSize={11} fill={AXIS_TEXT}>
          {formatDayDate(data[0].date, "numeric")}
        </text>
        {data.length > 1 && (
          <text x={x(data.length - 1)} y={H - 8} textAnchor="end" fontSize={11} fill={AXIS_TEXT}>
            {formatDayDate(data[data.length - 1].date, "numeric")}
          </text>
        )}

        {data.map((d, i) => {
          const b = band(i);
          return (
            <rect
              key={`hit-${d.key}`}
              x={b.x0}
              y={PAD.top}
              width={b.w}
              height={innerH}
              fill="transparent"
              tabIndex={0}
              aria-label={`${d.title}, ${formatDayDate(d.date, "numeric")}: ${pct(d.rate)} signed in, ${pct(d.completeRate)} completed`}
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
          className="pointer-events-none absolute top-6 z-10 w-max max-w-[14rem] -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg"
          style={{ left: `${Math.min(85, Math.max(15, (x(active) / W) * 100))}%` }}
        >
          <p className="font-semibold text-slate-800">{a.title}</p>
          <p className="text-slate-500">{formatDayDate(a.date, "numeric")}</p>
          {series.map((sr) => (
            <p key={sr.key} className="mt-0.5 flex items-center gap-2 text-slate-600">
              <span className="h-0.5 w-3" style={{ background: sr.color }} aria-hidden="true" />
              <span className="font-bold text-slate-900">{pct(a[sr.key])}</span> {sr.label.toLowerCase()}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
