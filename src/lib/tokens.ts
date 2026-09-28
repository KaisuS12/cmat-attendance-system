import { SignJWT, jwtVerify } from "jose";

// The QR code's payload is a signed JWT, not a bare row id — this proves at
// scan time that the token was actually issued by this server (with a
// passing geofence + window check) and hasn't been tampered with, without
// needing a DB round trip just to check a signature. Single-use enforcement
// still requires the DB row (see qr_tokens.used_at); the signature alone
// can't prevent replay within its validity window.
const QR_TOKEN_TTL_SECONDS = 60;

function getSecret() {
  const secret = process.env.QR_TOKEN_SECRET;
  if (!secret) throw new Error("QR_TOKEN_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export interface QrTokenPayload {
  jti: string; // qr_tokens.id
  studentId: string;
  eventDayId: string;
  type: "sign_in" | "sign_out";
}

export async function signQrToken(payload: QrTokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setJti(payload.jti)
    .setIssuedAt()
    .setExpirationTime(`${QR_TOKEN_TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifyQrToken(token: string): Promise<QrTokenPayload> {
  const { payload } = await jwtVerify(token, getSecret());
  return payload as unknown as QrTokenPayload;
}

export const QR_TOKEN_TTL_MS = QR_TOKEN_TTL_SECONDS * 1000;
