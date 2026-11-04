// Filters for an officer's activity log (scans and manual entries).

export const ACTIVITY_TABS = [
  { key: "all", label: "All" },
  { key: "sign_in", label: "Sign-in scans" },
  { key: "sign_out", label: "Sign-out scans" },
  { key: "manual", label: "Manual entries" },
] as const;

export type ActivityTab = (typeof ACTIVITY_TABS)[number]["key"];

export function parseActivityParams(params: Record<string, string | string[] | undefined>) {
  const text = (key: string) => (typeof params[key] === "string" ? (params[key] as string).trim() : "");
  const tab = ACTIVITY_TABS.find((t) => t.key === text("tab"))?.key ?? "all";
  const event = /^[0-9a-f-]{36}$/i.test(text("event")) ? text("event") : "";
  return { tab: tab as ActivityTab, q: text("q").slice(0, 80), event, page: Math.max(1, Number(text("page")) || 1) };
}

/** Narrows an attendance_records query to one tab. */
export function applyActivityTab<Q extends { eq(column: string, value: string): Q }>(query: Q, tab: ActivityTab): Q {
  if (tab === "manual") return query.eq("method", "manual");
  if (tab === "sign_in" || tab === "sign_out") return query.eq("method", "qr").eq("type", tab);
  return query;
}
