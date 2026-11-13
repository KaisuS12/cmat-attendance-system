import { describe, expect, it } from "vitest";
import { pageItems } from "@/lib/pagination";

describe("pageItems", () => {
  it("lists every page when there are few", () => {
    expect(pageItems(1, 1)).toEqual([1]);
    expect(pageItems(3, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("keeps the ends and the pages around the current one", () => {
    expect(pageItems(1, 25)).toEqual([1, 2, 3, "gap", 25]);
    expect(pageItems(12, 25)).toEqual([1, "gap", 10, 11, 12, 13, 14, "gap", 25]);
    expect(pageItems(25, 25)).toEqual([1, "gap", 23, 24, 25]);
  });
});
