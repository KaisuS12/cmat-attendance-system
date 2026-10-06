"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { decodeJwt } from "jose";
import { createClient } from "@/lib/supabase/client";
import { ENABLE_TOKEN_DEBUG_TOOLS } from "@/lib/constants";
import { btnPrimary, btnSecondary } from "@/components/ui";

type Status = "idle" | "locating" | "requesting" | "showing" | "recorded" | "error";

const GEO_ERRORS: Record<number, string> = {
  1: "Location permission is blocked. Allow location for this site in your browser settings, then try again.",
  2: "Your location couldn't be found. Turn on GPS / Location, step closer to an open area, and try again.",
  3: "Getting your location took too long. Make sure GPS is on and try again.",
};

export function AttendanceAction({
  eventDayId,
  type,
  disabled,
  disabledReason,
  size = "md",
  inverted = false,
}: {
  eventDayId: string;
  type: "sign_in" | "sign_out";
  disabled?: boolean;
  disabledReason?: string;
  /** "lg" for the big call-to-action on the student home. */
  size?: "md" | "lg";
  /** Light button for use on a dark background. */
  inverted?: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [tokenId, setTokenId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [expiresAt, setExpiresAt] = useState(0);
  const [now, setNow] = useState(0);

  const label = type === "sign_in" ? "Sign in" : "Sign out";

  // Once the countdown hits zero the QR is shown as expired, with a
  // fresh-code button, instead of a dead code being shown to the officer.
  const secondsLeft = Math.max(0, Math.ceil((expiresAt - now) / 1000));
  const expired = status === "showing" && secondsLeft <= 0;

  useEffect(() => {
    if (status !== "showing") return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [status]);

  // While the QR is up, watch for the attendance record this token creates
  // (students can read their own records under RLS). Once the officer's scan
  // lands, confirm on-screen. Checking the record, not the token's used_at,
  // means a scan that claimed the token but failed to record never shows ✓.
  useEffect(() => {
    if (status !== "showing" || expired || !tokenId) return;
    const supabase = createClient();
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("attendance_records")
        .select("id")
        .eq("qr_token_id", tokenId)
        .is("voided_at", null)
        .maybeSingle();
      if (data) setStatus("recorded");
    }, 2000);
    return () => clearInterval(interval);
  }, [status, expired, tokenId]);

  // Keep the screen awake while the QR is displayed.
  useEffect(() => {
    if (status !== "showing" || expired || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    navigator.wakeLock.request("screen").then((l) => (lock = l)).catch(() => {});
    return () => {
      lock?.release().catch(() => {});
    };
  }, [status, expired]);

  function handleGenerate() {
    setError(null);
    setStatus("locating");

    if (!("geolocation" in navigator)) {
      setError("This browser can't share your location, which is required to sign in. Try Chrome or Safari.");
      setStatus("error");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setStatus("requesting");
        try {
          const res = await fetch("/api/attendance/generate-token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              eventDayId,
              type,
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
            }),
          });
          const data = await res.json();

          if (!res.ok) {
            setError(data.error ?? "Could not generate a QR code.");
            setStatus("error");
            if (res.status === 409) router.refresh();
            return;
          }

          const dataUrl = await QRCode.toDataURL(data.token, { width: 480, margin: 4, errorCorrectionLevel: "M" });
          setQrDataUrl(dataUrl);
          setToken(data.token);
          setTokenId((decodeJwt(data.token).jti as string) ?? null);
          setCopied(false);
          // Count down on this device's clock from the server's TTL, so a
          // phone with a wrong clock still shows the right remaining time.
          const ttl = new Date(data.expiresAt).getTime() - new Date(data.issuedAt ?? Date.now()).getTime();
          setNow(Date.now());
          setExpiresAt(Date.now() + ttl);
          setStatus("showing");
        } catch {
          setError("Couldn't reach the server. Check your internet connection and try again.");
          setStatus("error");
        }
      },
      (geoError) => {
        setError(GEO_ERRORS[geoError.code] ?? "Your location couldn't be determined.");
        setStatus("error");
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  }

  function close() {
    const wasRecorded = status === "recorded";
    setStatus("idle");
    setQrDataUrl(null);
    setToken(null);
    setTokenId(null);
    if (wasRecorded) router.refresh();
  }

  if ((status === "showing" || status === "recorded") && qrDataUrl) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white p-6 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">{label}</p>

        {status === "recorded" ? (
          <div className="mt-6 flex flex-col items-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-100 text-5xl text-emerald-600">
              ✓
            </div>
            <p className="mt-4 text-xl font-semibold text-slate-900">
              {type === "sign_in" ? "You're signed in!" : "You're signed out!"}
            </p>
            <p className="mt-1 text-sm text-slate-500">Your attendance has been recorded.</p>
          </div>
        ) : (
          <>
            <div className="relative mt-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrDataUrl}
                alt={`${label} QR code`}
                className={`h-auto w-[min(80vw,22rem)] ${expired ? "opacity-10" : ""}`}
              />
              {expired && (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className="font-semibold text-slate-900">This code expired</p>
                  <button onClick={handleGenerate} className={`${btnPrimary} mt-3`}>
                    Generate a new code
                  </button>
                </div>
              )}
            </div>
            {!expired && (
              <>
                <p className="mt-4 text-base text-slate-700">
                  Expires in <span className="font-semibold tabular-nums">{secondsLeft}s</span>
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Turn your screen brightness up and show this to the officer.
                </p>
              </>
            )}
            {ENABLE_TOKEN_DEBUG_TOOLS && token && !expired && (
              <button
                onClick={() => {
                  navigator.clipboard.writeText(token);
                  setCopied(true);
                }}
                className="mt-3 text-xs font-medium text-slate-400 underline hover:text-slate-600"
              >
                {copied ? "Copied" : "Copy code (dev only: testing without a camera)"}
              </button>
            )}
          </>
        )}

        <button onClick={close} className={`${btnSecondary} mt-6 w-full max-w-xs`}>
          {status === "recorded" ? "Done" : "Close"}
        </button>
      </div>
    );
  }

  const busy = status === "locating" || status === "requesting";

  return (
    <div className="min-w-0">
      <button
        onClick={handleGenerate}
        disabled={disabled || busy}
        className={`${
          inverted
            ? "inline-flex items-center justify-center rounded-md bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:opacity-50"
            : btnPrimary
        } w-full ${size === "lg" ? "min-h-14 text-base" : "min-h-11 sm:w-auto"}`}
      >
        {status === "locating" ? "Checking location..." : status === "requesting" ? "Generating..." : label}
      </button>
      {disabled && disabledReason && <p className="mt-1 text-xs text-slate-400">{disabledReason}</p>}
      {error && (
        <p className={`mt-1.5 max-w-xs text-xs ${inverted ? "rounded bg-white/95 px-2 py-1 text-red-700" : "text-red-600"}`}>
          {error}
        </p>
      )}
    </div>
  );
}
