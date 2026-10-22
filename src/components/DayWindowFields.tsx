"use client";

import { formatDayDate, localInputToIso } from "@/lib/datetime";
import { dayWindowProblem } from "@/lib/windows";

// One attendance slot (a day, or a session of a day). Times are
// datetime-local strings, interpreted as Manila time (see lib/datetime.ts).
export interface DayInput {
  dayDate: string;
  signInStart: string;
  signInEnd: string;
  signOutStart: string;
  signOutEnd: string;
  /** false = sign-in only: signing in counts as present. Default true. */
  signOutRequired?: boolean;
}

type TimeField = "signInStart" | "signInEnd" | "signOutStart" | "signOutEnd";
export type SlotTimes = Record<TimeField, string>; // "HH:MM" each

export const DEFAULT_TIMES: SlotTimes = {
  signInStart: "07:30",
  signInEnd: "08:30",
  signOutStart: "16:00",
  signOutEnd: "17:00",
};
export const DAY_ALL_TIMES = DEFAULT_TIMES; // one session for the whole day
export const MORNING: SlotTimes = { signInStart: "07:30", signInEnd: "08:30", signOutStart: "11:30", signOutEnd: "12:30" };
export const AFTERNOON: SlotTimes = { signInStart: "12:30", signInEnd: "13:30", signOutStart: "16:30", signOutEnd: "17:30" };

const FIELDS: { key: TimeField; label: string }[] = [
  { key: "signInStart", label: "Sign-in opens" },
  { key: "signInEnd", label: "Sign-in closes" },
  { key: "signOutStart", label: "Sign-out opens" },
  { key: "signOutEnd", label: "Sign-out closes" },
];

export function emptyDay(): DayInput {
  return { dayDate: "", signInStart: "", signInEnd: "", signOutStart: "", signOutEnd: "", signOutRequired: true };
}

// Picking (or changing) the date fills in typical window times (or the given
// ones), or moves already-entered times to the new date.
export function withDate(day: DayInput, dayDate: string, defaults: SlotTimes = DEFAULT_TIMES): DayInput {
  if (!dayDate) return { ...day, dayDate };
  const next: DayInput = { ...day, dayDate };
  for (const { key } of FIELDS) {
    const time = day[key] ? day[key].slice(11, 16) : defaults[key];
    next[key] = `${dayDate}T${time}`;
  }
  return next;
}

/** The slot set to these times on its date. */
export function withTimes(day: DayInput, times: SlotTimes, date = day.dayDate): DayInput {
  const next: DayInput = { ...day };
  for (const { key } of FIELDS) next[key] = `${day[key].slice(0, 10) || date}T${times[key]}`;
  return next;
}

// Converts to the API's ISO shape, or returns a user-facing problem.
export function dayToPayload(
  day: DayInput
):
  | { ok: true; value: { dayDate: string; signOutRequired: boolean } & Record<TimeField, string> }
  | { ok: false; message: string } {
  if (!day.dayDate) return { ok: false, message: "Pick a date for each day." };
  const signOutRequired = day.signOutRequired !== false;
  const iso = {} as Record<TimeField, string>;
  for (const { key, label } of FIELDS) {
    if (!signOutRequired && (key === "signOutStart" || key === "signOutEnd")) continue;
    const v = localInputToIso(day[key]);
    if (!v) return { ok: false, message: `${label}: enter a valid date and time.` };
    iso[key] = v;
  }
  if (!signOutRequired) {
    // Not used; pinned to the end of sign-in so the session has an end.
    iso.signOutStart = iso.signInEnd;
    iso.signOutEnd = iso.signInEnd;
  }
  const problem = dayWindowProblem(iso, signOutRequired);
  if (problem) return { ok: false, message: problem.message };
  return { ok: true, value: { dayDate: day.dayDate, signOutRequired, ...iso } };
}

/** "16:30" → "4:30 PM" */
export function formatClock(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return "";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

const timeOf = (v: string) => v.slice(11, 16);

/** "in 7:30–8:30 AM, out 4:00–5:00 PM", or "in 7:30–8:30 AM (sign-in only)". */
export function describeSlot(value: DayInput): string {
  const range = (a: string, b: string) => `${formatClock(timeOf(a))}–${formatClock(timeOf(b))}`;
  const signIn = `in ${range(value.signInStart, value.signInEnd)}`;
  return value.signOutRequired === false ? `${signIn} (sign-in only)` : `${signIn}, out ${range(value.signOutStart, value.signOutEnd)}`;
}

// The times for one slot: a Sign-in box and a Sign-out box. The sign-out box
// can be switched off ("sign-in only"). With `showPresets`, quick-fill
// buttons set common times; with `showDate`, the slot picks its own date.
export function DayWindowFields({
  value,
  onChange,
  showDate = true,
  showPresets = true,
  allowSignOutToggle = true,
  showSummary = true,
}: {
  value: DayInput;
  onChange: (next: DayInput) => void;
  showDate?: boolean;
  showPresets?: boolean;
  allowSignOutToggle?: boolean;
  showSummary?: boolean;
}) {
  const inputCls =
    "mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm disabled:cursor-not-allowed disabled:bg-slate-100";
  const date = value.dayDate || value.signInStart.slice(0, 10);
  const ready = Boolean(date);
  const signOutRequired = value.signOutRequired !== false;

  // Times are picked on their own; the date comes from the day (each field
  // keeps its own date when editing an existing day).
  const setTime = (key: TimeField, time: string) =>
    onChange({ ...value, [key]: time ? `${value[key].slice(0, 10) || date}T${time}` : "" });

  const presets: { label: string; apply: () => void }[] = [
    { label: "Whole day", apply: () => onChange({ ...withTimes(value, DEFAULT_TIMES, date), signOutRequired: true }) },
    { label: "Morning", apply: () => onChange({ ...withTimes(value, MORNING, date), signOutRequired: true }) },
    { label: "Afternoon", apply: () => onChange({ ...withTimes(value, AFTERNOON, date), signOutRequired: true }) },
  ];
  if (allowSignOutToggle) {
    presets.push({ label: "Sign-in only", apply: () => onChange({ ...withTimes(value, DEFAULT_TIMES, date), signOutRequired: false }) });
  }

  const filled = ["signInStart", "signInEnd", ...(signOutRequired ? ["signOutStart", "signOutEnd"] : [])].every((k) =>
    timeOf(value[k as TimeField])
  );
  const problem = filled
    ? dayWindowProblem(
        {
          signInStart: localInputToIso(value.signInStart) ?? "",
          signInEnd: localInputToIso(value.signInEnd) ?? "",
          signOutStart: localInputToIso(value.signOutStart) ?? "",
          signOutEnd: localInputToIso(value.signOutEnd) ?? "",
        },
        signOutRequired
      )
    : null;

  const timeInputs = (from: TimeField, to: TimeField) => (
    <div className="mt-2 grid grid-cols-2 gap-2">
      {(
        [
          [from, "Opens"],
          [to, "Closes"],
        ] as const
      ).map(([key, label]) => (
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
          Pick the date first. Typical times are filled in for you, and you can adjust them after.
        </p>
      ) : (
        showPresets && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-slate-500">Quick fill:</span>
            {presets.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={p.apply}
                className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:border-gold-400 hover:bg-gold-100"
              >
                {p.label}
              </button>
            ))}
          </div>
        )
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <fieldset className="rounded-lg border border-slate-200 border-l-4 border-l-brand-600 bg-white p-3">
          <legend className="sr-only">Sign-in</legend>
          <p className="text-sm font-semibold text-slate-800">Sign-in</p>
          <p className="text-xs text-slate-500">When students can sign in on arrival</p>
          {timeInputs("signInStart", "signInEnd")}
        </fieldset>

        <fieldset
          className={`rounded-lg border border-slate-200 border-l-4 bg-white p-3 ${signOutRequired ? "border-l-gold-400" : "border-l-slate-300"}`}
        >
          <legend className="sr-only">Sign-out</legend>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-slate-800">Sign-out</p>
              <p className="text-xs text-slate-500">
                {signOutRequired ? "When students can sign out before leaving" : "No sign-out: signing in counts as present"}
              </p>
            </div>
            {allowSignOutToggle && (
              <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-600">
                <input
                  type="checkbox"
                  checked={signOutRequired}
                  disabled={!ready}
                  onChange={(e) => {
                    const on = e.target.checked;
                    // Turning it back on gives the sign-out box real times again.
                    onChange(
                      on && timeOf(value.signOutEnd) <= timeOf(value.signInEnd)
                        ? { ...withTimes(value, { ...DEFAULT_TIMES, signInStart: timeOf(value.signInStart), signInEnd: timeOf(value.signInEnd) }, date), signOutRequired: true }
                        : { ...value, signOutRequired: on }
                    );
                  }}
                  className="h-4 w-4 accent-brand-700"
                />
                Required
              </label>
            )}
          </div>
          {signOutRequired && timeInputs("signOutStart", "signOutEnd")}
        </fieldset>
      </div>

      {/* Problems always show; the "✓ students sign in…" line only when asked. */}
      {ready && filled && (problem || showSummary) && (
        <p
          className={`rounded-lg px-3 py-2 text-xs ${problem ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}
          role={problem ? "alert" : undefined}
        >
          {problem ? <>⚠ {problem.message}</> : <>✓ {formatDayDate(date, "short")}: students sign {describeSlot(value)}.</>}
        </p>
      )}
    </div>
  );
}
