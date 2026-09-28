"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Html5Qrcode } from "html5-qrcode";

interface ScanResult {
  ok: boolean;
  message: string;
  studentName?: string;
  studentId?: string;
  type?: string;
}

const SCANNER_ELEMENT_ID = "qr-scanner-region";

export default function ScannerPage() {
  const params = useParams<{ eventDayId: string }>();
  const router = useRouter();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const busyRef = useRef(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualToken, setManualToken] = useState("");
  const [manualSubmitting, setManualSubmitting] = useState(false);

  const submitScan = useCallback(async (token: string) => {
    try {
      const res = await fetch("/api/attendance/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, eventDayId: params.eventDayId }),
      });
      const data = await res.json();

      if (!res.ok) {
        setResult({ ok: false, message: data.error ?? "Scan failed." });
      } else {
        setResult({
          ok: true,
          message: "Recorded",
          studentName: data.student?.full_name,
          studentId: data.student?.student_id,
          type: data.type,
        });
      }
    } catch {
      setResult({ ok: false, message: "Network error — try again." });
    }
  }, [params.eventDayId]);

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!manualToken.trim()) return;
    setManualSubmitting(true);
    await submitScan(manualToken.trim());
    setManualSubmitting(false);
    setManualToken("");
  }

  useEffect(() => {
    let cancelledBeforeStart = false;
    const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 250 },
        async (decodedText) => {
          if (busyRef.current) return;
          busyRef.current = true;

          await submitScan(decodedText);

          setTimeout(() => {
            busyRef.current = false;
          }, 2000);
        },
        undefined
      )
      .then(() => {
        // The effect was cleaned up (e.g. React Strict Mode's dev-only
        // double-invoke) before start() resolved — stop it now that it's
        // actually running, since the cleanup below couldn't yet.
        if (cancelledBeforeStart) {
          scanner.stop().catch(() => {});
        }
      })
      .catch(() => setCameraError("Could not access the camera. Check browser permissions."));

    return () => {
      cancelledBeforeStart = true;
      // stop() throws synchronously (not a rejected Promise) if scanning
      // hasn't actually started yet, so only call it once isScanning is true.
      if (scanner.isScanning) {
        scanner.stop().catch(() => {});
      }
    };
  }, [params.eventDayId, submitScan]);

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <button onClick={() => router.back()} className="text-sm text-slate-500 hover:text-slate-900">
        ← Back
      </button>
      <h1 className="mt-2 text-xl font-semibold text-slate-900">Scan Attendance</h1>

      {cameraError && <p className="mt-4 text-sm text-red-600">{cameraError}</p>}

      <div id={SCANNER_ELEMENT_ID} className="mt-4 overflow-hidden rounded-xl" />

      <details className="mt-4 rounded-lg border border-slate-200 p-3">
        <summary className="cursor-pointer text-sm font-medium text-slate-600">
          No camera, or testing without one? Paste a code instead.
        </summary>
        <form onSubmit={handleManualSubmit} className="mt-3 flex gap-2">
          <input
            value={manualToken}
            onChange={(e) => setManualToken(e.target.value)}
            placeholder="Paste the student's code"
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={manualSubmitting}
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {manualSubmitting ? "..." : "Submit"}
          </button>
        </form>
      </details>

      {result && (
        <div
          className={`mt-4 rounded-xl border p-4 ${
            result.ok ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"
          }`}
        >
          {result.ok ? (
            <>
              <p className="text-lg font-semibold text-emerald-800">{result.studentName}</p>
              <p className="text-sm text-emerald-700">
                {result.studentId} · {result.type === "sign_in" ? "Signed in" : "Signed out"}
              </p>
            </>
          ) : (
            <p className="text-sm font-medium text-red-700">{result.message}</p>
          )}
        </div>
      )}

      <p className="mt-4 text-center text-xs text-slate-400">
        Confirm the name shown matches the person in front of you before letting them proceed.
      </p>
    </div>
  );
}
