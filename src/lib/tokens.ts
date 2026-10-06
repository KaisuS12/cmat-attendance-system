import { SignJWT, jwtVerify } from "jose";

// The QR code's payload is a signed JWT, not a bare row id — this proves at
// scan time that the token was actually issued by this server (with a
// passing geofence + window check) and hasn't been tampered with, without
// needing a DB round trip just to check a signature. Single-use enforcement
// still requires the DB row (see qr_tokens.used_at); the signature alone
// can't prevent replay within its validity window.
//
// The token carries only the row id (jti) and expiry: the student, event day
// and type live in the qr_tokens row. Fewer characters make a much less
// dense QR code, which phone cameras read far more reliably off a screen.
const QR_TOKEN_TTL_SECONDS = 60;

function getSecret() {
  const secret = process.env.QR_TOKEN_SECRET;
  if (!secret) throw new Error("QR_TOKEN_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export interface QrTokenPayload {
  jti: string; // qr_tokens.id
}

export async function signQrToken({ jti }: QrTokenPayload): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setJti(jti)
    .setExpirationTime(`${QR_TOKEN_TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifyQrToken(token: string): Promise<QrTokenPayload> {
  const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
  if (typeof payload.jti !== "string") throw new Error("Token has no id");
  return { jti: payload.jti };
}

export const QR_TOKEN_TTL_MS = QR_TOKEN_TTL_SECONDS * 1000;
