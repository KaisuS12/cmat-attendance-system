// Every event happens on campus in the Philippines, so all times are shown and
// entered in Manila time regardless of where the code runs. Server components
// render on the host's clock (UTC on Vercel), and a bare toLocaleString()
// there would show every time 8 hours off. The Philippines has no DST, so a
// fixed offset is exact.
export const APP_TIMEZONE = "Asia/Manila";
export const APP_UTC_OFFSET = "+08:00";

const dateTimeFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIMEZONE,
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const shortDateTimeFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIMEZONE,
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const timeFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIMEZONE,
  hour: "numeric",
  minute: "2-digit",
});

const inputPartsFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** "Sep 28, 2026, 9:05 AM" */
export function formatDateTime(iso: string): string {
  return dateTimeFormat.format(new Date(iso));
}

/** "Sep 28, 9:05 AM" */
export function formatShortDateTime(iso: string): string {
  return shortDateTimeFormat.format(new Date(iso));
}

/** "9:05 AM" */
export function formatTime(iso: string): string {
  return timeFormat.format(new Date(iso));
}

/**
 * Formats a `date` column value ("2026-09-28"). Parsed as a calendar date and
 * formatted in UTC so it never slides to the previous/next day.
 */
export function formatDayDate(
  day: string,
  style: "long" | "short" | "numeric" = "short"
): string {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const options: Intl.DateTimeFormatOptions =
    style === "long"
      ? { weekday: "long", month: "long", day: "numeric", year: "numeric" }
      : style === "short"
      ? { weekday: "short", month: "short", day: "numeric" }
      : { month: "short", day: "numeric", year: "numeric" };
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(date);
}

function manilaParts(date: Date) {
  const parts = Object.fromEntries(
    inputPartsFormat.formatToParts(date).map((p) => [p.type, p.value])
  );
  return parts as Record<"year" | "month" | "day" | "hour" | "minute", string>;
}

/** ISO timestamp → value for an `<input type="datetime-local">`, in Manila time. */
export function isoToLocalInput(iso: string): string {
  const p = manilaParts(new Date(iso));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

const LOCAL_INPUT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/**
 * `<input type="datetime-local">` value (interpreted as Manila time) → ISO
 * timestamp. Returns null for empty or malformed input instead of throwing.
 */
export function localInputToIso(value: string): string | null {
  if (!LOCAL_INPUT_RE.test(value)) return null;
  const date = new Date(`${value}:00${APP_UTC_OFFSET}`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Today's calendar date in Manila, as "YYYY-MM-DD". */
export function todayInAppTz(now: Date = new Date()): string {
  const p = manilaParts(now);
  return `${p.year}-${p.month}-${p.day}`;
}

// The current time for a dynamic (per-request) server render. Server
// components here are force-dynamic, so reading the clock once per request is
// intended; this keeps that explicit in one place.
export function requestTime(): number {
  return Date.now();
}

export type WindowState = "not_open" | "open" | "closed";

export function windowState(startIso: string, endIso: string, now = Date.now()): WindowState {
  if (now < new Date(startIso).getTime()) return "not_open";
  if (now > new Date(endIso).getTime()) return "closed";
  return "open";
}
