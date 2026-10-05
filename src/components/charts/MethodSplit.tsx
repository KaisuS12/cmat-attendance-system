"use client";

import { useState } from "react";

// Validated pair (dataviz validator, light mode): lightness band, CVD and
// contrast all pass.
const QR_COLOR = "#3d6fcc";
const MANUAL_COLOR = "#b98a00";

// Part-to-whole of how sign-ins were recorded: QR scan vs officer manual
// entry. Legend plus direct counts, so color is never the only cue.
export function MethodSplit({ qr, manual }: { qr: number; manual: number }) {
  const [active, setActive] = useState<"qr" | "manual" | null>(null);
  const total = qr + manual;
  if (total === 0) return <p className="text-sm text-slate-500">No sign-ins yet.</p>;

  const share = (n: number) => Math.round((n / total) * 100);
  const segments = [
    { key: "qr" as const, label: "QR scan", value: qr, color: QR_COLOR },
    { key: "manual" as const, label: "Manual entry", value: manual, color: MANUAL_COLOR },
  ].filter((s) => s.value > 0);

  return (
    <div>
      <div className="relative">
        <div className="flex h-5 gap-0.5 overflow-hidden rounded-[4px]" onMouseLeave={() => setActive(null)}>
          {segments.map((s) => (
            <div
              key={s.key}
              tabIndex={0}
              role="img"
              aria-label={`${s.label}: ${s.value} (${share(s.value)}%)`}
              onMouseEnter={() => setActive(s.key)}
              onFocus={() => setActive(s.key)}
              onBlur={() => setActive(null)}
              onTouchStart={() => setActive(s.key)}
              className={`h-full outline-none transition-[filter] focus-visible:ring-2 focus-visible:ring-gold-300 ${active === s.key ? "brightness-110" : ""}`}
              style={{ width: `${(s.value / total) * 100}%`, background: s.color, minWidth: 6 }}
            />
          ))}
        </div>
        {active && (
          <div className="pointer-events-none absolute -top-9 left-1/2 z-10 w-max -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs shadow-lg">
            <span className="font-bold text-slate-900">{active === "qr" ? qr : manual}</span>
            <span className="text-slate-600">
              {" "}
              {active === "qr" ? "QR scans" : "manual entries"} · {share(active === "qr" ? qr : manual)}%
            </span>
          </div>
        )}
      </div>

      <ul className="mt-3 space-y-1.5 text-sm">
        {[
          { label: "QR scan", value: qr, color: QR_COLOR },
          { label: "Manual entry (officer override)", value: manual, color: MANUAL_COLOR },
        ].map((s) => (
          <li key={s.label} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-slate-700">
              <span className="h-3 w-3 rounded-[3px]" style={{ background: s.color }} aria-hidden="true" />
              {s.label}
            </span>
            <span className="text-slate-600">
              <span className="font-semibold text-slate-900">{s.value}</span> · {share(s.value)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
