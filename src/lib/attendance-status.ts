import { formatDayDate } from "@/lib/datetime";

// One rule for "attended" everywhere (reports, clearance, student record):
// signed in, and signed out too unless that slot has no sign-out.
export function isComplete(
  row: { signIn: unknown; signOut: unknown },
  day: { sign_out_required?: boolean | null }
): boolean {
  return Boolean(row.signIn) && (Boolean(row.signOut) || day.sign_out_required === false);
}

/** "Thu, Oct 23 · Morning", or just the date when the day has one slot. */
export function slotLabel(
  day: { day_date: string; session?: string | null },
  style: "long" | "short" | "numeric" = "short"
): string {
  const date = formatDayDate(day.day_date, style);
  return day.session ? `${date} · ${day.session}` : date;
}
