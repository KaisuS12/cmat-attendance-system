"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

// Narrows an officer's activity log to one event; keeps the other filters.
export function ActivityEventSelect({ events, value }: { events: { id: string; title: string }[]; value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <label className="flex min-w-0 items-center gap-2 text-sm text-slate-600">
      <span className="shrink-0">Event</span>
      <select
        id="activity-event"
        value={value}
        onChange={(e) => {
          const params = new URLSearchParams(searchParams.toString());
          params.delete("page");
          if (e.target.value) params.set("event", e.target.value);
          else params.delete("event");
          router.replace(params.size ? `${pathname}?${params}` : pathname, { scroll: false });
        }}
        className="min-w-0 max-w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
      >
        <option value="">All events</option>
        {events.map((e) => (
          <option key={e.id} value={e.id}>
            {e.title}
          </option>
        ))}
      </select>
    </label>
  );
}
