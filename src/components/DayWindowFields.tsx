"use client";

import { formatDayDate, localInputToIso } from "@/lib/datetime";
import { dayWindowProblem } from "@/lib/windows";

// datetime-local strings, interpreted as Manila time (see lib/datetime.ts).
export interface DayInput {
  dayDate: string;
  signInStart: string;
  signInEnd: string;
  signOutStart: string;
  signOutEnd: string;
}

type TimeField = Exclude<keyof DayInput, "dayDate">;

const DEFAULT_TIMES: Record<TimeField, string> = {
  signInStart: "07:30",
  signInEnd: "08:30",
  signOutStart: "16:00",
  signOutEnd: "17:00",
};

const FIELDS: { key: TimeField; label: string }[] = [
  { key: "signInStart", label: "Sign-in opens" },
  { key: "signInEnd", label: "Sign-in closes" },
  { key: "signOutStart", label: "Sign-out opens" },
  { key: "signOutEnd", label: "Sign-out closes" },
];

export function emptyDay(): DayInput {
  return { dayDate: "", signInStart: "", signInEnd: "", signOutStart: "", signOutEnd: "" };
}

// Picking (or changing) the date fills in typical window times, or moves
// already-entered times to the new date, so each day takes one input.
export function withDate(day: DayInput, dayDate: string): DayInput {
  if (!dayDate) return { ...day, dayDate };
  const next: DayInput = { ...day, dayDate };
  for (const { key } of FIELDS) {
    const time = day[key] ? day[key].slice(11, 16) : DEFAULT_TIMES[key];
    next[key] = `${dayDate}T${time}`;
  }
  return next;
}

// Converts to the API's ISO shape, or returns a user-facing problem.
export function dayToPayload(
  day: DayInput
): { ok: true; value: { dayDate: string } & Record<TimeField, string> } | { ok: false; message: string } {
  if (!day.dayDate) return { ok: false, message: "Pick a date for each day." };
  const iso = {} as Record<TimeField, string>;
  for (const { key, label } of FIELDS) {
    const v = localInputToIso(day[key]);
    if (!v) return { ok: false, message: `${label}: enter a valid date and time.` };
    iso[key] = v;
  }
  const problem = dayWindowProblem(iso);
  if (problem) return { ok: false, message: problem.message };
  return { ok: true, value: { dayDate: day.dayDate, ...iso } };
}

// Quick fills for the usual schedules (Manila time, 1-hour windows).
const PRESETS: { label: string; times: Record<TimeField, string> }[] = [
  { label: "Whole day", times: DEFAULT_TIMES },
  { label: "Morning", times: { signInStart: "07:30", signInEnd: "08:30", signOutStart: "11:30", signOutEnd: "12:30" } },
  { label: "Afternoon", times: { signInStart: "12:30", signInEnd: "13:30", signOutStart: "16:30", signOutEnd: "17:30" } },
];

/** "16:30" → "4:30 PM" */
function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return "";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

const timeOf = (v: string) => v.slice(11, 16);

export function DayWindowFields({
  value,
  onChange,
  showDate = true,
}: {
  value: DayInput;
  onChange: (next: DayInput) => void;
  showDate?: boolean;
}) {
  const inputCls =
    "mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm disabled:cursor-not-allowed disabled:bg-slate-100";
  const date = value.dayDate || value.signInStart.slice(0, 10);
  const ready = Boolean(date);

  // Times are picked on their own; the date comes from the day (each field
  // keeps its own date when editing an existing day).
  const setTime = (key: TimeField, time: string) =>
    onChange({ ...value, [key]: time ? `${value[key].slice(0, 10) || date}T${time}` : "" });

  const applyPreset = (times: Record<TimeField, string>) => {
    const next = { ...value };
    for (const { key } of FIELDS) next[key] = `${value[key].slice(0, 10) || date}T${times[key]}`;
    onChange(next);
  };

  const filled = FIELDS.every(({ key }) => timeOf(value[key]));
  const problem = filled
    ? dayWindowProblem({
        signInStart: localInputToIso(value.signInStart) ?? "",
        signInEnd: localInputToIso(value.signInEnd) ?? "",
        signOutStart: localInputToIso(value.signOutStart) ?? "",
        signOutEnd: localInputToIso(value.signOutEnd) ?? "",
      })
    : null;

  const windowBox = (title: string, hint: string, from: TimeField, to: TimeField, accent: string) => (
    <fieldset className={`rounded-lg border border-slate-200 border-l-4 ${accent} bg-white p-3`}>
      <legend className="sr-only">{title}</legend>
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <p className="text-xs text-slate-500">{hint}</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {([
          [from, "Opens"],
          [to, "Closes"],
        ] as const).map(([key, label]) => (
          <label key={key} className="text-xs font-medium text-slate-500">
            {label}
            <input
              required
              type="time"
              disabled={!ready}
              value={timeOf(value[key])}
              onChange={(e) => setTime(key, e.target.value)}
              aria-invalid={problem?.field === key || undefined}
              className={`${inputCls} ${problem?.field === key ? "border-red-400 ring-1 ring-red-300" : ""}`}
            />
          </label>
        ))}
      </div>
    </fieldset>
  );

  return (
    <div className="space-y-3">
      {showDate && (
        <label className="block text-xs font-medium text-slate-500">
          Date
          <input
            required
            type="date"
            value={value.dayDate}
            onChange={(e) => onChange(withDate(value, e.target.value))}
            className={inputCls}
          />
        </label>
      )}

      {!ready ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2 text-xs text-slate-500">
          Pick the date first — typical times are filled in for you, and you can adjust them after.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-500">Quick fill:</span>
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => applyPreset(p.times)}
              className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:border-gold-400 hover:bg-gold-100"
              title={`Sign in ${formatTime(p.times.signInStart)}–${formatTime(p.times.signInEnd)}, sign out ${formatTime(p.times.signOutStart)}–${formatTime(p.times.signOutEnd)}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {windowBox("Sign-in", "When students can sign in on arrival", "signInStart", "signInEnd", "border-l-brand-600")}
        {windowBox("Sign-out", "When students can sign out before leaving", "signOutStart", "signOutEnd", "border-l-gold-400")}
      </div>

      {ready && filled && (
        <p
          className={`rounded-lg px-3 py-2 text-xs ${problem ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}
          role={problem ? "alert" : undefined}
        >
          {problem ? (
            <>⚠ {problem.message}</>
          ) : (
            <>
              ✓ {formatDayDate(date, "short")}: students sign in{" "}
              <strong>
                {formatTime(timeOf(value.signInStart))}–{formatTime(timeOf(value.signInEnd))}
              </strong>{" "}
              and sign out{" "}
              <strong>
                {formatTime(timeOf(value.signOutStart))}–{formatTime(timeOf(value.signOutEnd))}
              </strong>
              .
            </>
          )}
        </p>
      )}
    </div>
  );
}
