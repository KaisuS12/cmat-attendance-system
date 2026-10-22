import { describe, expect, it } from "vitest";
import { dayCardToPayloads, emptyDayCard, type DayCardValue } from "@/components/DayCard";

const session = (name: string, inS: string, inE: string, outS: string, outE: string, signOutRequired = true) => ({
  dayDate: "2026-10-23",
  session: name,
  signInStart: `2026-10-23T${inS}`,
  signInEnd: `2026-10-23T${inE}`,
  signOutStart: `2026-10-23T${outS}`,
  signOutEnd: `2026-10-23T${outE}`,
  signOutRequired,
});

describe("dayCardToPayloads", () => {
  it("turns a whole day into a morning and an afternoon session", () => {
    const card: DayCardValue = {
      ...emptyDayCard(),
      title: "Field Day",
      dayDate: "2026-10-23",
      sessions: [session("Morning", "07:30", "08:30", "11:30", "12:30"), session("Afternoon", "12:30", "13:30", "16:30", "17:30")],
    };
    const p = dayCardToPayloads(card, "");
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.value.map((v) => [v.session, v.title, v.signOutRequired])).toEqual([
      ["Morning", "Field Day", true],
      ["Afternoon", "Field Day", true],
    ]);
    expect(p.value[0].signInStart).toBe("2026-10-22T23:30:00.000Z"); // 7:30 AM Manila
  });

  it("sign-in only: no sign-out times needed, pinned to the end of sign-in", () => {
    const card: DayCardValue = { ...emptyDayCard(), dayDate: "2026-10-23", sessions: [session("", "07:30", "08:30", "", "", false)] };
    const p = dayCardToPayloads(card, "");
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.value[0]).toMatchObject({ signOutRequired: false, signOutStart: p.value[0].signInEnd, signOutEnd: p.value[0].signInEnd });
  });

  it("asks for names when there are several sessions", () => {
    const card: DayCardValue = {
      ...emptyDayCard(),
      dayDate: "2026-10-23",
      sessions: [session("", "07:30", "08:30", "11:30", "12:30"), session("Afternoon", "12:30", "13:30", "16:30", "17:30")],
    };
    const p = dayCardToPayloads(card, "Day 1: ");
    expect(p.ok).toBe(false);
    if (!p.ok) expect(p.message).toMatch(/^Day 1: give each session a name/);
  });
});
