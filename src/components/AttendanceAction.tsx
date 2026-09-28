"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

type Status = "idle" | "locating" | "requesting" | "showing" | "error";

export function AttendanceAction({
  eventDayId,
  type,
  disabled,
  disabledReason,
}: {
  eventDayId: string;
  type: "sign_in" | "sign_out";
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (status !== "showing" || secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [status, secondsLeft]);

  async function handleGenerate() {
    setError(null);
    setStatus("locating");

    if (!("geolocation" in navigator)) {
      setError("This device does not support location — required to sign in.");
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
            }),
          });
          const data = await res.json();

          if (!res.ok) {
            setError(data.error ?? "Could not generate QR code.");
            setStatus("error");
            return;
          }

          const dataUrl = await QRCode.toDataURL(data.token, { width: 280, margin: 1 });
          setQrDataUrl(dataUrl);
          setToken(data.token);
          setCopied(false);
          const secs = Math.max(1, Math.round((new Date(data.expiresAt).getTime() - Date.now()) / 1000));
          setSecondsLeft(secs);
          setStatus("showing");
        } catch {
          setError("Something went wrong. Please try again.");
          setStatus("error");
        }
      },
      () => {
        setError("Location permission is required to generate a QR code.");
        setStatus("error");
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  const label = type === "sign_in" ? "Sign In" : "Sign Out";

  if (status === "showing" && qrDataUrl) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-xs rounded-xl bg-white p-6 text-center shadow-lg">
          <h3 className="text-sm font-medium text-slate-500">{label} QR Code</h3>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt="QR code" className="mx-auto mt-4 h-56 w-56" />
          <canvas ref={canvasRef} className="hidden" />
          <p className="mt-4 text-sm text-slate-600">
            Expires in <span className="font-semibold">{secondsLeft}s</span>
          </p>
          <p className="mt-1 text-xs text-slate-400">Show this to the officer scanning attendance.</p>
          <button
            onClick={() => {
              if (token) {
                navigator.clipboard.writeText(token);
                setCopied(true);
              }
            }}
            className="mt-3 text-xs font-medium text-slate-400 underline hover:text-slate-600"
          >
            {copied ? "Copied" : "Copy code (for testing without a camera)"}
          </button>
          <button
            onClick={() => setStatus("idle")}
            className="mt-3 w-full rounded-md border border-slate-300 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={handleGenerate}
        disabled={disabled || status === "locating" || status === "requesting"}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {status === "locating"
          ? "Checking location..."
          : status === "requesting"
          ? "Generating..."
          : label}
      </button>
      {disabled && disabledReason && <p className="mt-1 text-xs text-slate-400">{disabledReason}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
