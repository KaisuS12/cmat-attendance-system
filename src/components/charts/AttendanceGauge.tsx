// Ring gauge for a single ratio (a meter, not a pie): gold arc on a lighter
// gold track, with the value in the middle.
export function AttendanceGauge({ rate, label }: { rate: number | null; label: string }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const value = rate === null ? 0 : Math.max(0, Math.min(1, rate));
  const text = rate === null ? "—" : `${Math.round(value * 100)}%`;

  return (
    <div className="relative mx-auto h-40 w-40">
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90" role="img" aria-label={`${label}: ${text}`}>
        <circle cx="64" cy="64" r={r} fill="none" stroke="#fef6d8" strokeWidth="14" />
        <circle
          cx="64"
          cy="64"
          r={r}
          fill="none"
          stroke="#b98a00"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${value * c} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-brand-800">{text}</span>
        <span className="text-[11px] text-slate-500">{label}</span>
      </div>
    </div>
  );
}
