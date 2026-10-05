"use client";

import { localInputToIso } from "@/lib/datetime";
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

export function DayWindowFields({
  value,
  onChange,
  showDate = true,
}: {
  value: DayInput;
  onChange: (next: DayInput) => void;
  showDate?: boolean;
}) {
  const inputCls = "mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm";

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {showDate && (
        <label className="text-xs font-medium text-slate-500 sm:col-span-2">
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
      {FIELDS.map(({ key, label }) => (
        <label key={key} className="text-xs font-medium text-slate-500">
          {label}
          <input
            required
            type="datetime-local"
            value={value[key]}
            onChange={(e) => onChange({ ...value, [key]: e.target.value })}
            className={inputCls}
          />
        </label>
      ))}
    </div>
  );
}
