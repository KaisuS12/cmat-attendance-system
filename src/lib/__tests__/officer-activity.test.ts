import { describe, expect, it } from "vitest";
import { applyActivityTab, parseActivityParams, type ActivityTab } from "@/lib/officer-activity";

describe("parseActivityParams", () => {
  it("falls back to safe defaults", () => {
    expect(parseActivityParams({})).toEqual({ tab: "all", q: "", event: "", page: 1 });
    expect(parseActivityParams({ tab: "nope", event: "1;drop", page: "-3" })).toEqual({ tab: "all", q: "", event: "", page: 1 });
  });

  it("keeps valid filters", () => {
    const event = "9a0cc537-0000-4000-8000-000000000000";
    expect(parseActivityParams({ tab: "manual", q: " cruz ", event, page: "2" })).toEqual({ tab: "manual", q: "cruz", event, page: 2 });
  });
});

describe("applyActivityTab", () => {
  const run = (tab: ActivityTab) => {
    const calls: [string, string][] = [];
    const query = { eq(column: string, value: string) { calls.push([column, value]); return query; } };
    applyActivityTab(query, tab);
    return calls;
  };

  it("separates scans from manual entries", () => {
    expect(run("all")).toEqual([]);
    expect(run("manual")).toEqual([["method", "manual"]]);
    expect(run("sign_in")).toEqual([["method", "qr"], ["type", "sign_in"]]);
    expect(run("sign_out")).toEqual([["method", "qr"], ["type", "sign_out"]]);
  });
});
