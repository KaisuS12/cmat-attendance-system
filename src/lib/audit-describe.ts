import { formatDayDate, formatTime } from "@/lib/datetime";
import { slotLabel } from "@/lib/attendance-status";

// Turns stored audit entries into plain sentences for the audit log page.
// Entries keep what they recorded (ids and raw values); everything here is
// presentation, so past entries read the same way as new ones.

export interface AuditEntryInput {
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, unknown> | null;
}

export interface AuditNames {
  events: Map<string, string>; // event id → title
  days: Map<string, { day_date: string; session: string | null; event_id: string; eventTitle: string }>;
  people: Map<string, string>; // profile id → full name
  venues: Map<string, string>;
  semesters: Map<string, string>;
}

export const emptyAuditNames = (): AuditNames => ({
  events: new Map(),
  days: new Map(),
  people: new Map(),
  venues: new Map(),
  semesters: new Map(),
});

export interface AuditChange {
  label: string;
  from: string;
  to: string;
}

export interface AuditDescription {
  category: AuditCategoryKey;
  sentence: string;
  changes: AuditChange[];
  note?: string;
  href?: { url: string; label: string };
}

export const AUDIT_CATEGORIES = [
  {
    key: "events",
    label: "Events",
    dot: "bg-brand-600",
    actions: [
      "event_created",
      "event_updated",
      "event_deleted",
      "event_day_added",
      "event_day_removed",
      "event_day_window_updated",
      "sign_out_cancelled",
      "sign_out_restored",
    ],
  },
  { key: "attendance", label: "Manual entries & voids", dot: "bg-amber-500", actions: ["attendance_manual_entry", "attendance_voided"] },
  {
    key: "students",
    label: "Students",
    dot: "bg-emerald-600",
    actions: ["students_bulk_imported", "student_updated", "student_devices_reset"],
  },
  {
    key: "accounts",
    label: "Accounts & passwords",
    dot: "bg-gold-500",
    actions: [
      "officer_account_created",
      "admin_account_created",
      "role_changed",
      "account_deactivated",
      "account_reactivated",
      "staff_deleted",
      "password_reset",
      "password_changed",
    ],
  },
  {
    key: "schoolyear",
    label: "School year",
    dot: "bg-slate-400",
    actions: ["semester_created", "semester_activated", "program_years_updated", "school_year_promoted", "school_year_undone"],
  },
  { key: "privacy", label: "Privacy views", dot: "bg-red-500", actions: ["manual_proof_viewed", "temp_password_viewed"] },
  { key: "scans", label: "Every scan", dot: "bg-slate-300", actions: ["attendance_scanned", "qr_token_generated"] },
] as const;

export type AuditCategoryKey = (typeof AUDIT_CATEGORIES)[number]["key"] | "other";

export function auditCategory(action: string): AuditCategoryKey {
  return AUDIT_CATEGORIES.find((c) => (c.actions as readonly string[]).includes(action))?.key ?? "other";
}

// ── small helpers ────────────────────────────────────────────────────────

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const text = (v: unknown): string => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");
const num = (v: unknown): number => (typeof v === "number" ? v : Number(v) || 0);
const quoted = (s: string) => `“${s}”`;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const possessive = (name: string) => (name.endsWith("s") ? `${name}’` : `${name}’s`);
const typeWord = (v: unknown) => (v === "sign_out" ? "sign-out" : "sign-in");

function listOr(v: unknown, empty: string): string {
  const items = Array.isArray(v) ? v.map(text).filter(Boolean) : [];
  return items.length ? items.join(", ") : empty;
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/** "7:30–8:30 AM" from two ISO times (Manila). */
function timeRange(start: unknown, end: unknown): string {
  const s = text(start);
  const e = text(end);
  if (!s || !e) return "—";
  const a = formatTime(s);
  const b = formatTime(e);
  const [aTime, aPeriod] = a.split(" ");
  const [bTime, bPeriod] = b.split(" ");
  return aPeriod === bPeriod ? `${aTime}–${bTime} ${bPeriod}` : `${a}–${b}`;
}

function humanize(key: string): string {
  const words = key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function readableAction(action: string): string {
  return humanize(action);
}

// ── names ───────────────────────────────────────────────────────────────

function eventName(id: unknown, names: AuditNames, fallbackTitle?: unknown): string {
  const title = (typeof id === "string" && names.events.get(id)) || text(fallbackTitle);
  return title ? quoted(title) : "an event that was later deleted";
}

/** “General Assembly” · Thu, Nov 20 · Morning */
function dayName(id: unknown, names: AuditNames, fallback?: { eventId?: unknown; dayDate?: unknown; session?: unknown }): string {
  const day = typeof id === "string" ? names.days.get(id) : undefined;
  if (day) return `${quoted(day.eventTitle)} · ${slotLabel(day)}`;
  const date = text(fallback?.dayDate);
  const event = eventName(fallback?.eventId, names);
  if (!date) return event;
  return `${event} · ${slotLabel({ day_date: date, session: text(fallback?.session) || null })}`;
}

function personName(id: unknown, names: AuditNames, fallbackName?: unknown): string {
  return text(fallbackName) || (typeof id === "string" && names.people.get(id)) || "a student";
}

function eventLink(id: unknown): AuditDescription["href"] {
  return typeof id === "string" && UUID.test(id) ? { url: `/officer/events/${id}`, label: "Open event" } : undefined;
}

function studentLink(id: unknown): AuditDescription["href"] {
  return typeof id === "string" && UUID.test(id) ? { url: `/admin/students/${id}`, label: "Open student" } : undefined;
}

function staffLink(id: unknown): AuditDescription["href"] {
  return typeof id === "string" && UUID.test(id) ? { url: `/admin/officers/${id}`, label: "Open activity" } : undefined;
}

// ── field changes ───────────────────────────────────────────────────────

const EVENT_FIELDS: Record<string, { label: string; show: (v: unknown, names: AuditNames) => string }> = {
  title: { label: "Title", show: (v) => text(v) || "—" },
  description: { label: "Description", show: (v) => text(v) || "(none)" },
  venue_id: { label: "Venue", show: (v, n) => (typeof v === "string" && n.venues.get(v)) || "another venue" },
  target_programs: { label: "Programs", show: (v) => listOr(v, "All programs") },
  target_year_levels: { label: "Year levels", show: (v) => listOr(v, "All year levels") },
};

const STUDENT_FIELDS: Record<string, string> = {
  full_name: "Name",
  student_id: "Student ID",
  program: "Program",
  year_level: "Year level",
};

function diff(
  before: unknown,
  after: unknown,
  fields: Record<string, { label: string; show: (v: unknown, names: AuditNames) => string }>,
  names: AuditNames
): AuditChange[] {
  const b = (before && typeof before === "object" ? before : {}) as Record<string, unknown>;
  const a = (after && typeof after === "object" ? after : {}) as Record<string, unknown>;
  return Object.entries(fields)
    .filter(([key]) => key in a && !sameValue(b[key], a[key]))
    .map(([key, f]) => ({ label: f.label, from: f.show(b[key], names), to: f.show(a[key], names) }));
}

/** Readable "Name: value" pairs for entries this file has no wording for. */
function genericChanges(details: Record<string, unknown>): string {
  return Object.entries(details)
    .filter(([, v]) => (typeof v === "string" && !UUID.test(v) && v.trim()) || typeof v === "number" || typeof v === "boolean")
    .map(([k, v]) => `${humanize(k)}: ${typeof v === "boolean" ? (v ? "yes" : "no") : String(v)}`)
    .join(" · ");
}

// ── the sentences ───────────────────────────────────────────────────────

export function describeAuditEntry(entry: AuditEntryInput, names: AuditNames): AuditDescription {
  const d = entry.details ?? {};
  const id = entry.entity_id;
  const category = auditCategory(entry.action);
  const base = { category, changes: [] as AuditChange[] };

  switch (entry.action) {
    // Events
    case "event_created": {
      const programs = listOr(d.targetPrograms, "");
      const years = listOr(d.targetYearLevels, "");
      const who = programs || years ? [programs, years && `Year ${years}`].filter(Boolean).join(" · ") : "all students";
      const days = num(d.dayCount);
      return {
        ...base,
        sentence: `Created the event ${eventName(id, names, d.title)}${days ? ` (${plural(days, "day")})` : ""} for ${who}`,
        href: eventLink(id),
      };
    }
    case "event_updated": {
      const after = (d.after ?? {}) as Record<string, unknown>;
      const changes = diff(d.before, after, EVENT_FIELDS, names);
      return {
        ...base,
        sentence: `Edited the event ${eventName(id, names, after.title ?? (d.before as Record<string, unknown> | undefined)?.title)}`,
        changes,
        note: changes.length ? undefined : "Saved without changes.",
        href: eventLink(id),
      };
    }
    case "event_deleted":
      return { ...base, sentence: `Deleted the event ${quoted(text(d.title) || "(untitled)")}` };
    case "event_day_added":
      return {
        ...base,
        sentence: `Added ${text(d.dayDate) ? formatDayDate(text(d.dayDate)) : "a day"} to ${eventName(d.eventId, names)}`,
        href: eventLink(d.eventId),
      };
    case "event_day_removed":
      return {
        ...base,
        sentence: `Removed ${text(d.dayDate) ? formatDayDate(text(d.dayDate)) : "a day"} from ${eventName(d.eventId, names)}`,
        href: eventLink(d.eventId),
      };
    case "event_day_window_updated": {
      const before = (d.before ?? {}) as Record<string, unknown>;
      const after = (d.after ?? {}) as Record<string, unknown>;
      const changes: AuditChange[] = [];
      for (const [label, s, e] of [
        ["Sign-in", "sign_in_start", "sign_in_end"],
        ["Sign-out", "sign_out_start", "sign_out_end"],
      ] as const) {
        const from = timeRange(before[s], before[e]);
        const to = timeRange(after[s] ?? before[s], after[e] ?? before[e]);
        if (from !== to) changes.push({ label, from, to });
      }
      const day = typeof id === "string" ? names.days.get(id) : undefined;
      return {
        ...base,
        sentence: `Changed the times of ${dayName(id, names)}`,
        changes,
        note: changes.length ? undefined : "Saved without changes.",
        href: eventLink(day?.event_id),
      };
    }
    case "sign_out_cancelled":
    case "sign_out_restored":
      return {
        ...base,
        sentence: `${entry.action === "sign_out_cancelled" ? "Cancelled sign-out for" : "Turned sign-out back on for"} ${dayName(id, names, { eventId: d.eventId, dayDate: d.dayDate, session: d.session })}`,
        note: entry.action === "sign_out_cancelled" ? "Everyone who signed in counts as present." : undefined,
        href: eventLink(d.eventId),
      };

    // Attendance
    case "attendance_scanned":
      return {
        ...base,
        sentence: `Scanned ${possessive(personName(d.studentId, names))} ${typeWord(d.type)}`,
        href: studentLink(d.studentId),
      };
    case "qr_token_generated":
      return { ...base, sentence: "Made a QR code to sign in or out" };
    case "attendance_manual_entry":
      return {
        ...base,
        sentence: `Manually ${d.type === "sign_out" ? "signed out" : "signed in"} ${personName(d.studentId, names, d.studentName)} at ${dayName(d.eventDayId, names)}${d.hasPhoto ? " (with ID photo)" : ""}`,
        note: text(d.reason) ? `Reason: ${text(d.reason)}` : undefined,
        href: studentLink(d.studentId),
      };
    case "attendance_voided":
      return {
        ...base,
        sentence: `Voided ${possessive(personName(undefined, names, d.studentName))} ${typeWord(d.type)} at ${dayName(d.eventDayId, names)}`,
        note: text(d.reason) ? `Reason: ${text(d.reason)}` : undefined,
      };

    // Students
    case "students_bulk_imported":
      return {
        ...base,
        sentence: `Imported a masterlist: ${num(d.created)} new, ${num(d.updated)} updated, ${num(d.existing)} already existed${num(d.failed) ? `, ${num(d.failed)} failed` : ""}`,
      };
    case "student_updated": {
      const fields = Object.fromEntries(
        Object.entries(STUDENT_FIELDS).map(([k, label]) => [k, { label, show: (v: unknown) => text(v) || "—" }])
      );
      const changes = diff(d.before, d.after, fields, names);
      const name = text((d.before as Record<string, unknown> | undefined)?.full_name) || personName(id, names);
      return {
        ...base,
        sentence: `Edited student ${name}`,
        changes,
        note: changes.length ? undefined : "Saved without changes.",
        href: studentLink(id),
      };
    }
    case "student_devices_reset":
      return {
        ...base,
        sentence: `Reset ${possessive(personName(id, names, d.fullName))} phones (${plural(num(d.phonesForgotten), "phone")} forgotten)`,
        href: studentLink(id),
      };

    // Accounts & passwords
    case "officer_account_created":
    case "admin_account_created":
      return {
        ...base,
        sentence: `Added ${personName(id, names, d.fullName)} as ${entry.action === "admin_account_created" ? "an admin" : "an officer"}`,
        note: text(d.email) ? `Email: ${text(d.email)}` : undefined,
        href: staffLink(id),
      };
    case "role_changed":
      return {
        ...base,
        sentence: `Made ${personName(id, names, d.fullName)} ${d.to === "admin" ? "an admin" : "an officer"}`,
        changes: d.from && d.to ? [{ label: "Role", from: humanize(text(d.from)), to: humanize(text(d.to)) }] : [],
        href: staffLink(id),
      };
    case "account_deactivated":
      return {
        ...base,
        sentence: d.removed
          ? `Removed officer ${personName(id, names, d.fullName)}`
          : `Deactivated ${personName(id, names, d.fullName)}`,
        note: d.removed ? "Kept under Former officers because their name is on past records." : "They can't log in until reactivated.",
        href: d.role === "student" ? studentLink(id) : staffLink(id),
      };
    case "account_reactivated":
      return {
        ...base,
        sentence: `Reactivated ${personName(id, names, d.fullName)}`,
        href: d.role === "student" ? studentLink(id) : staffLink(id),
      };
    case "staff_deleted":
      return { ...base, sentence: `Deleted the officer account of ${text(d.fullName) || "an officer"}` };
    case "password_reset":
      return {
        ...base,
        sentence: `Reset ${possessive(personName(id, names, d.fullName))} password`,
        href: d.role === "student" ? studentLink(id) : staffLink(id),
      };
    case "password_changed":
      return { ...base, sentence: "Changed their own password" };

    // School year & semesters
    case "semester_created": {
      const start = text(d.startDate);
      const end = text(d.endDate);
      const range = start && end ? ` (${formatDayDate(start, "numeric")} – ${formatDayDate(end, "numeric")})` : "";
      return {
        ...base,
        sentence: `Created the semester ${quoted(text(d.name) || "(unnamed)")}${range}${d.makeActive ? " and set it as active" : ""}`,
      };
    }
    case "semester_activated": {
      const name = typeof id === "string" ? names.semesters.get(id) : undefined;
      return { ...base, sentence: `Set ${name ? quoted(name) : "a semester"} as the active semester` };
    }
    case "program_years_updated": {
      const list = Array.isArray(d.programs)
        ? d.programs
            .map(text)
            .filter(Boolean)
            .map((p) => p.replace(/: (\d+)$/, " $1 years"))
            .join(", ")
        : "";
      return { ...base, sentence: `Set how many years each program runs${list ? `: ${list}` : ""}` };
    }
    case "school_year_promoted":
      return {
        ...base,
        sentence: `Started the new school year: ${num(d.promoted)} moved up a year, ${num(d.graduating)} graduated`,
        note: num(d.skipped) ? `${plural(num(d.skipped), "student")} skipped (year wasn't a number).` : undefined,
      };
    case "school_year_undone":
      return { ...base, sentence: `Undid the new school year (${plural(num(d.restored), "student")} restored)` };

    // Privacy
    case "manual_proof_viewed":
      return {
        ...base,
        sentence: `Viewed the ID photo for ${possessive(text(d.studentName) || "a student")} manual entry${text(d.officerName) ? ` (taken by ${text(d.officerName)})` : ""}`,
      };
    case "temp_password_viewed":
      return {
        ...base,
        sentence: `Looked at ${possessive(personName(id, names, d.studentName))} temporary password`,
        href: studentLink(id),
      };

    default: {
      const extra = genericChanges(d);
      return { ...base, category: "other", sentence: readableAction(entry.action), note: extra || undefined };
    }
  }
}

/** The ids an entry mentions, so the page can load their names in a few queries. */
export function auditEntryReferences(entry: AuditEntryInput) {
  const d = entry.details ?? {};
  const pick = (v: unknown) => (typeof v === "string" && UUID.test(v) ? [v] : []);
  const eventIds = [...(entry.entity_type === "events" ? pick(entry.entity_id) : []), ...pick(d.eventId)];
  const dayIds = [...(entry.entity_type === "event_days" ? pick(entry.entity_id) : []), ...pick(d.eventDayId)];
  const peopleIds = [...(entry.entity_type === "profiles" ? pick(entry.entity_id) : []), ...pick(d.studentId)];
  const semesterIds = entry.entity_type === "semesters" ? pick(entry.entity_id) : [];
  const venueIds =
    entry.action === "event_updated"
      ? [
          ...pick((d.before as Record<string, unknown> | undefined)?.venue_id),
          ...pick((d.after as Record<string, unknown> | undefined)?.venue_id),
        ]
      : [];
  return { eventIds, dayIds, peopleIds, semesterIds, venueIds };
}
