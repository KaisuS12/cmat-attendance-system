import { describe, expect, it } from "vitest";
import { isJpeg, PROOF_MAX_BYTES, proofPhotoProblem, proofPurgeCutoff } from "@/lib/proof-photos";

const jpeg = (size = 10) => {
  const b = new Uint8Array(size);
  b.set([0xff, 0xd8, 0xff]);
  return b;
};

describe("proof photo checks", () => {
  it("recognizes JPEGs by their first bytes", () => {
    expect(isJpeg(jpeg())).toBe(true);
    expect(isJpeg(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d]))).toBe(false); // PNG
    expect(isJpeg(new Uint8Array())).toBe(false);
  });

  it("explains unusable photos", () => {
    expect(proofPhotoProblem(jpeg())).toBeNull();
    expect(proofPhotoProblem(new Uint8Array())).toMatch(/Take a photo/);
    expect(proofPhotoProblem(jpeg(PROOF_MAX_BYTES + 1))).toMatch(/too large/);
    expect(proofPhotoProblem(new Uint8Array(20))).toMatch(/couldn't be read/);
  });

  it("deletes photos after 90 days", () => {
    expect(proofPurgeCutoff(Date.UTC(2026, 3, 1)).toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });
});
