import { beforeAll, describe, expect, it } from "vitest";
import { signQrToken, verifyQrToken } from "@/lib/tokens";

beforeAll(() => {
  process.env.QR_TOKEN_SECRET = "test-secret-that-is-long-enough-for-hs256";
});

describe("QR tokens", () => {
  const jti = "6d32e9f4-c14a-4e9c-aadb-d5641df61665";

  it("round-trips the row id", async () => {
    const token = await signQrToken({ jti });
    expect(await verifyQrToken(token)).toEqual({ jti });
  });

  it("stays short enough for an easy-to-scan QR code", async () => {
    expect((await signQrToken({ jti })).length).toBeLessThan(160);
  });

  it("rejects a tampered token", async () => {
    const token = await signQrToken({ jti });
    const [h, p, sig] = token.split(".");
    const forged = `${h}.${p}.${sig.slice(0, -2)}${sig.endsWith("AA") ? "BB" : "AA"}`;
    await expect(verifyQrToken(forged)).rejects.toThrow();
  });
});
