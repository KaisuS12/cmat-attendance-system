"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatDayDate, todayInAppTz } from "@/lib/datetime";

export interface CalendarItem {
  date: string; // YYYY-MM-DD
  eventId: string;
  title: string;
}

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTH = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

const pad = (n: number) => String(n).padStart(2, "0");

// Month calendar of event days (Manila time): event days are gold, today has
// a navy ring. Tapping a day lists its events with links.
export function EventCalendar({ items }: { items: CalendarItem[] }) {
  const today = todayInAppTz();
  const byDate = useMemo(() => {
    const m = new Map<string, CalendarItem[]>();
    for (const it of items) m.set(it.date, [...(m.get(it.date) ?? []), it]);
    return m;
  }, [items]);

  const [ty, tm] = today.split("-").map(Number);
  const [view, setView] = useState({ y: ty, m: tm - 1 });
  const [selected, setSelected] = useState<string>(() => {
    if (byDate.has(today)) return today;
    return items.find((i) => i.date >= today)?.date ?? today;
  });

  const first = new Date(Date.UTC(view.y, view.m, 1));
  const daysInMonth = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: first.getUTCDay() }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const move = (delta: number) =>
    setView((v) => {
      const d = new Date(Date.UTC(v.y, v.m + delta, 1));
      return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
    });

  const selectedItems = byDate.get(selected) ?? [];

  return (
    <div>
      <div className="flex items-center justify-between">
        <button onClick={() => move(-1)} className="h-8 w-8 rounded-md text-slate-500 hover:bg-slate-100" aria-label="Previous month">
          ‹
        </button>
        <p className="text-sm font-semibold text-brand-800">{MONTH.format(first)}</p>
        <button onClick={() => move(1)} className="h-8 w-8 rounded-md text-slate-500 hover:bg-slate-100" aria-label="Next month">
          ›
        </button>
      </div>

      <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[11px]">
        {WEEKDAYS.map((d, i) => (
          <span key={i} className="py-1 font-semibold text-slate-400">
            {d}
          </span>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <span key={`e${i}`} />;
          const date = `${view.y}-${pad(view.m + 1)}-${pad(day)}`;
          const has = byDate.has(date);
          const isToday = date === today;
          const isSelected = date === selected;
          return (
            <button
              key={date}
              onClick={() => setSelected(date)}
              aria-label={`${formatDayDate(date, "long")}${has ? `, ${byDate.get(date)!.length} event(s)` : ""}`}
              aria-pressed={isSelected}
              className={`flex h-8 items-center justify-center rounded-md text-xs transition ${
                has ? "bg-gold-400 font-bold text-brand-800 hover:bg-gold-300" : "text-slate-600 hover:bg-slate-100"
              } ${isToday ? "ring-2 ring-brand-700 ring-offset-1" : ""} ${isSelected && !has ? "bg-brand-50" : ""} ${
                isSelected && has ? "outline outline-2 outline-offset-1 outline-gold-600" : ""
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>

      <div className="mt-3 border-t border-slate-100 pt-2">
        <p className="text-xs font-medium text-slate-500">{formatDayDate(selected, "short")}</p>
        {selectedItems.length === 0 ? (
          <p className="mt-1 text-xs text-slate-400">No events this day.</p>
        ) : (
          <ul className="mt-1 space-y-1">
            {selectedItems.map((it) => (
              <li key={`${it.eventId}-${it.date}`}>
                <Link href={`/officer/events/${it.eventId}`} className="flex items-center gap-2 text-sm text-brand-800 hover:underline">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-gold-400" aria-hidden="true" />
                  <span className="truncate">{it.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
