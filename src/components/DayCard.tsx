"use client";

import {
  AFTERNOON,
  DAY_ALL_TIMES,
  DayWindowFields,
  dayToPayload,
  describeSlot,
  emptyDay,
  MORNING,
  withDate,
  withTimes,
  type DayInput,
  type SlotTimes,
} from "@/components/DayWindowFields";
import { emptyVenue, SAME_VENUE, VenuePicker, venueToPayload, type VenueValue } from "@/components/VenuePicker";
import { formatDayDate } from "@/lib/datetime";
import type { Venue } from "@/types/database";

// One day of an event: an optional title, the date, one or more attendance
// sessions (e.g. Morning and Afternoon, each with its own sign-in and
// sign-out, or sign-in only), and the venue.
export type SessionDraft = DayInput & { session: string };
export interface DayCardValue {
  title: string;
  dayDate: string;
  venue: VenueValue;
  sessions: SessionDraft[];
}

export function emptyDayCard(): DayCardValue {
  return { title: "", dayDate: "", venue: emptyVenue(SAME_VENUE), sessions: [{ ...emptyDay(), session: "" }] };
}

/** The same sessions and times on another date (for "+ Add another day"). */
export function dayCardOnDate(card: DayCardValue, dayDate: string): DayCardValue {
  return {
    ...card,
    title: "",
    dayDate,
    sessions: card.sessions.map((s) => ({ ...withDate(s, dayDate), session: s.session })),
  };
}

const slot = (date: string, times: SlotTimes, session: string, signOutRequired = true): SessionDraft => ({
  ...withTimes({ ...emptyDay(), dayDate: date }, times, date),
  dayDate: date,
  session,
  signOutRequired,
});

type DayPayload = Extract<ReturnType<typeof dayToPayload>, { ok: true }>["value"];

/** One API entry per session, or the first problem to show. */
export function dayCardToPayloads(
  card: DayCardValue,
  label: string
):
  | { ok: true; value: (DayPayload & { title?: string; session: string; venue?: object })[] }
  | { ok: false; message: string } {
  const venue = venueToPayload(card.venue);
  if (!venue.ok) return { ok: false, message: `${label}${venue.message}` };
  const multi = card.sessions.length > 1;
  const names = card.sessions.map((s) => s.session.trim().toLowerCase());
  if (multi && names.some((n) => !n)) return { ok: false, message: `${label}give each session a name (e.g. Morning, Afternoon).` };
  if (new Set(names).size !== names.length) return { ok: false, message: `${label}two sessions have the same name.` };

  const value = [];
  for (const s of card.sessions) {
    const p = dayToPayload({ ...s, dayDate: card.dayDate });
    const who = multi ? `${s.session.trim()}: ` : "";
    if (!p.ok) return { ok: false, message: `${label}${who}${p.message}` };
    value.push({
      ...p.value,
      session: s.session.trim(),
      ...(card.title.trim() ? { title: card.title.trim() } : {}),
      ...(venue.value ? { venue: venue.value } : {}),
    });
  }
  return { ok: true, value };
}

export function DayCard({
  id,
  value,
  onChange,
  venues,
  heading,
  onRemove,
  titlePlaceholder = "e.g. Opening Ceremony",
}: {
  id: string;
  value: DayCardValue;
  onChange: (next: DayCardValue) => void;
  venues: Venue[];
  heading?: string;
  onRemove?: () => void;
  titlePlaceholder?: string;
}) {
  const date = value.dayDate;
  const set = (patch: Partial<DayCardValue>) => onChange({ ...value, ...patch });
  const setSession = (i: number, next: SessionDraft) =>
    set({ sessions: value.sessions.map((s, idx) => (idx === i ? next : s)) });

  const presets: { label: string; sessions: () => SessionDraft[] }[] = [
    { label: "Whole day (morning + afternoon)", sessions: () => [slot(date, MORNING, "Morning"), slot(date, AFTERNOON, "Afternoon")] },
    { label: "Morning only", sessions: () => [slot(date, MORNING, "")] },
    { label: "Afternoon only", sessions: () => [slot(date, AFTERNOON, "")] },
    { label: "One session, all day", sessions: () => [slot(date, DAY_ALL_TIMES, "")] },
    { label: "Sign-in only", sessions: () => [slot(date, DAY_ALL_TIMES, "", false)] },
  ];

  function addSession() {
    const sessions = value.sessions.map((s, i) => (i === 0 && !s.session.trim() ? { ...s, session: "Morning" } : s));
    const name = sessions.length === 1 ? "Afternoon" : `Session ${sessions.length + 1}`;
    set({ sessions: [...sessions, slot(date, AFTERNOON, name)] });
  }

  const multi = value.sessions.length > 1;

  return (
    <div className="rounded-lg bg-slate-50 p-3">
      {(heading || onRemove) && (
        <div className="mb-2 flex items-center justify-between">
          {heading && <span className="text-sm font-medium text-slate-700">{heading}</span>}
          {onRemove && (
            <button type="button" onClick={onRemove} className="text-xs text-red-600 hover:underline">
              Remove day
            </button>
          )}
        </div>
      )}

      <div className="space-y-3">
        <label htmlFor={`${id}-title`} className="block text-xs font-medium text-slate-500">
          Day title <span className="font-normal text-slate-400">(optional)</span>
          <input
            id={`${id}-title`}
            value={value.title}
            maxLength={80}
            onChange={(e) => set({ title: e.target.value })}
            placeholder={titlePlaceholder}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm"
          />
        </label>

        <label htmlFor={`${id}-date`} className="block text-xs font-medium text-slate-500">
          Date
          <input
            id={`${id}-date`}
            required
            type="date"
            value={date}
            onChange={(e) => {
              const d = e.target.value;
              set({
                dayDate: d,
                sessions: value.sessions.map((s, i) => ({
                  ...withDate(s, d, multi ? (i === 0 ? MORNING : AFTERNOON) : DAY_ALL_TIMES),
                  session: s.session,
                })),
              });
            }}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm"
          />
        </label>

        {date ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-slate-500">Quick fill:</span>
            {presets.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => set({ sessions: p.sessions() })}
                className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:border-gold-400 hover:bg-gold-100"
              >
                {p.label}
              </button>
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2 text-xs text-slate-500">
            Pick the date first. Typical times are filled in for you, and you can adjust them after.
          </p>
        )}

        {value.sessions.map((s, i) => (
          <div key={i} className={multi ? "space-y-2 rounded-lg border border-slate-200 bg-white/60 p-2.5" : ""}>
            {multi && (
              <div className="flex items-end gap-2">
                <label htmlFor={`${id}-s${i}-name`} className="flex-1 text-xs font-medium text-slate-500">
                  Session {i + 1} name
                  <input
                    id={`${id}-s${i}-name`}
                    value={s.session}
                    maxLength={30}
                    onChange={(e) => setSession(i, { ...s, session: e.target.value })}
                    placeholder={i === 0 ? "Morning" : "Afternoon"}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => set({ sessions: value.sessions.filter((_, idx) => idx !== i) })}
                  className="pb-2 text-xs text-red-600 hover:underline"
                >
                  Remove session
                </button>
              </div>
            )}
            <DayWindowFields
              value={{ ...s, dayDate: date }}
              onChange={(next) => setSession(i, { ...next, session: s.session })}
              showDate={false}
              showPresets={false}
              showSummary={false}
            />
          </div>
        ))}

        {date && (
          <button type="button" onClick={addSession} className="text-xs font-medium text-brand-700 underline">
            + Add session (e.g. afternoon sign-in and sign-out)
          </button>
        )}

        {date && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            ✓ {formatDayDate(date, "short")}:{" "}
            {value.sessions
              .map((s) => `${s.session.trim() ? `${s.session.trim()}: ` : ""}${describeSlot({ ...s, dayDate: date })}`)
              .join(" · ")}
          </p>
        )}

        <div>
          <p className="mb-1 text-xs font-medium text-slate-500">Venue for this day</p>
          <VenuePicker
            id={`${id}-venue`}
            venues={venues}
            value={value.venue}
            allowSame
            onChange={(venue) => set({ venue })}
          />
        </div>
      </div>
    </div>
  );
}
