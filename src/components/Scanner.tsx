"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { formatDayDate, formatTime, windowState } from "@/lib/datetime";
import { Alert, btnPrimary, btnSecondary, inputClass, labelClass } from "@/components/ui";
import type { AttendanceType, EventDay } from "@/types/database";

interface StudentInfo {
  id?: string;
  full_name: string;
  student_id: string | null;
  program: string | null;
  year_level: string | null;
  section: string | null;
}

interface ScanResult {
  ok: boolean;
  message: string;
  student?: StudentInfo;
  type?: AttendanceType;
  manual?: boolean;
}

interface RecentScan {
  key: string;
  name: string;
  studentId: string | null;
  type: AttendanceType;
  at: Date;
  manual: boolean;
}

const SCANNER_ELEMENT_ID = "qr-scanner-region";
// A token is valid for 60s; ignoring a repeat of the same text for this long
// means the camera re-reading a code still held up can't turn a success red.
const SAME_TOKEN_IGNORE_MS = 60_000;

// Short beeps: high for success, low double for errors. Created lazily on
// the first tap, since browsers block audio until the user interacts.
let audioCtx: AudioContext | null = null;
function unlockAudio() {
  if (!audioCtx && typeof window !== "undefined" && "AudioContext" in window) {
    audioCtx = new AudioContext();
  }
  audioCtx?.resume().catch(() => {});
}
function feedback(ok: boolean) {
  navigator.vibrate?.(ok ? 120 : [80, 60, 80]);
  if (!audioCtx) return;
  const tones = ok ? [880] : [220, 220];
  tones.forEach((freq, i) => {
    const osc = audioCtx!.createOscillator();
    const gain = audioCtx!.createGain();
    osc.frequency.value = freq;
    gain.gain.value = 0.15;
    osc.connect(gain).connect(audioCtx!.destination);
    const start = audioCtx!.currentTime + i * 0.18;
    osc.start(start);
    osc.stop(start + 0.12);
  });
}

function describe(s: StudentInfo) {
  return [s.student_id, s.program, [s.year_level, s.section].filter(Boolean).join("-")].filter(Boolean).join(" · ");
}

export function Scanner({
  day,
  eventId,
  eventTitle,
  venueName,
  initialCounts,
  debugTools,
}: {
  day: EventDay;
  eventId: string;
  eventTitle: string;
  venueName: string;
  initialCounts: Record<AttendanceType, number>;
  debugTools: boolean;
}) {
  const busyRef = useRef(false);
  const lastTokenRef = useRef<{ token: string; at: number } | null>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [sheet, setSheet] = useState<null | "manual" | "recent">(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [counts, setCounts] = useState(initialCounts);
  const [recent, setRecent] = useState<RecentScan[]>([]);
  const [now, setNow] = useState(() => Date.now());
  // Flashlight control, set once the camera is running (null = unsupported).
  const [torch, setTorch] = useState<{ on: boolean; apply: (on: boolean) => Promise<void> } | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    window.addEventListener("pointerdown", unlockAudio);
    return () => window.removeEventListener("pointerdown", unlockAudio);
  }, []);

  // Keep the scanning phone's screen on for the whole session.
  useEffect(() => {
    if (!("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let released = false;
    const acquire = () => {
      if (document.visibilityState !== "visible") return;
      navigator.wakeLock
        .request("screen")
        .then((l) => {
          if (released) l.release().catch(() => {});
          else lock = l;
        })
        .catch(() => {});
    };
    acquire();
    // The lock is dropped whenever the tab is hidden; take it again on return.
    document.addEventListener("visibilitychange", acquire);
    return () => {
      released = true;
      document.removeEventListener("visibilitychange", acquire);
      lock?.release().catch(() => {});
    };
  }, []);

  const signInState = windowState(day.sign_in_start, day.sign_in_end, now);
  const signOutState = windowState(day.sign_out_start, day.sign_out_end, now);
  const windowLabel =
    signInState === "open"
      ? { tone: "open", text: `Sign-in open until ${formatTime(day.sign_in_end)}` }
      : signOutState === "open"
      ? { tone: "open", text: `Sign-out open until ${formatTime(day.sign_out_end)}` }
      : signInState === "not_open"
      ? { tone: "closed", text: `Sign-in opens at ${formatTime(day.sign_in_start)}` }
      : signOutState === "not_open"
      ? { tone: "closed", text: `Sign-out opens at ${formatTime(day.sign_out_start)}` }
      : { tone: "closed", text: "All windows for this day have closed" };

  const showResult = useCallback((r: ScanResult) => {
    setResult(r);
    feedback(r.ok);
    if (r.ok && r.student && r.type) {
      const student = r.student;
      const type = r.type;
      setCounts((c) => ({ ...c, [type]: c[type] + 1 }));
      setRecent((prev) =>
        [
          {
            key: `${Date.now()}-${student.student_id}`,
            name: student.full_name,
            studentId: student.student_id,
            type,
            at: new Date(),
            manual: !!r.manual,
          },
          ...prev,
        ].slice(0, 20)
      );
    }
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    clearTimerRef.current = setTimeout(() => setResult(null), r.ok ? 3000 : 5000);
  }, []);

  // Returns false only when the server was never reached, so the same code
  // can be scanned again right away.
  const submitScan = useCallback(
    async (token: string): Promise<boolean> => {
      try {
        const res = await fetch("/api/attendance/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, eventDayId: day.id }),
        });
        const data = await res.json();

        if (!res.ok) {
          showResult({ ok: false, message: data.error ?? "Scan failed." });
        } else {
          showResult({ ok: true, message: "Recorded", student: data.student, type: data.type });
        }
        return true;
      } catch {
        showResult({ ok: false, message: "Network error — check the connection and scan again." });
        return false;
      }
    },
    [day.id, showResult]
  );

  // Camera lifecycle. The camera is released while the manual-entry panel is
  // open, and restarted when switching between back and front cameras.
  const cameraOn = sheet !== "manual";
  useEffect(() => {
    if (!cameraOn) return;
    let cancelledBeforeStart = false;
    const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID, {
      verbose: false,
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      // Native barcode detection (Android Chrome) is much faster than the
      // JavaScript decoder; it falls back automatically where unsupported.
      experimentalFeatures: { useBarCodeDetectorIfSupported: true },
    });

    scanner
      .start(
        { facingMode: facing },
        // No qrbox: the whole camera view is scanned, so the QR doesn't have
        // to be lined up inside a small square.
        { fps: 15 },
        async (decodedText) => {
          if (busyRef.current) return;
          const last = lastTokenRef.current;
          if (last && last.token === decodedText && Date.now() - last.at < SAME_TOKEN_IGNORE_MS) return;

          busyRef.current = true;
          lastTokenRef.current = { token: decodedText, at: Date.now() };
          const reachedServer = await submitScan(decodedText);
          if (!reachedServer) lastTokenRef.current = null;
          // Brief pause so the officer sees the result before the next read.
          setTimeout(() => {
            busyRef.current = false;
          }, 1200);
        },
        undefined
      )
      .then(() => {
        // The effect was cleaned up before start() resolved — stop it now that
        // it's actually running, since the cleanup couldn't yet.
        if (cancelledBeforeStart) {
          scanner.stop().catch(() => {});
          return;
        }
        setCameraError(null);
        setCameraReady(true);
        // Gyms are often dim and phone screens reflect overhead lights; the
        // flashlight helps the camera read the student's screen.
        try {
          const feature = scanner.getRunningTrackCameraCapabilities().torchFeature();
          if (feature.isSupported()) setTorch({ on: false, apply: (on) => feature.apply(on) });
        } catch {
          // capabilities API unavailable on this browser
        }
      })
      .catch(() =>
        setCameraError("Couldn't open the camera. Allow camera access for this site in your browser settings.")
      );

    return () => {
      cancelledBeforeStart = true;
      // stop() throws synchronously (not a rejected Promise) if scanning
      // hasn't actually started yet, so only call it once isScanning is true.
      if (scanner.isScanning) scanner.stop().catch(() => {});
      setTorch(null);
      setCameraReady(false);
    };
  }, [cameraOn, facing, submitScan]);

  const toolButton =
    "flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl bg-white/10 text-xs font-medium text-white transition active:scale-95 active:bg-white/20 disabled:opacity-40";

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* Top bar */}
      <div className="flex items-center gap-3 px-3 py-2">
        <Link
          href={`/officer/events/${eventId}`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-xl active:bg-white/20"
          aria-label="Back to event"
        >
          ←
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{eventTitle}</p>
          <p className="truncate text-xs text-white/60">
            {formatDayDate(day.day_date, "short")} · {venueName}
          </p>
        </div>
        <div className="flex shrink-0 gap-1.5 text-center">
          <div className="min-w-12 rounded-lg bg-white/10 px-2 py-1">
            <p className="text-lg font-bold leading-tight">{counts.sign_in}</p>
            <p className="text-[10px] uppercase tracking-wide text-white/60">In</p>
          </div>
          <div className="min-w-12 rounded-lg bg-white/10 px-2 py-1">
            <p className="text-lg font-bold leading-tight">{counts.sign_out}</p>
            <p className="text-[10px] uppercase tracking-wide text-white/60">Out</p>
          </div>
        </div>
      </div>

      <p
        className={`mx-3 rounded-full px-3 py-1 text-center text-xs font-medium ${
          windowLabel.tone === "open" ? "bg-emerald-500/20 text-emerald-200" : "bg-amber-400/20 text-amber-200"
        }`}
      >
        {windowLabel.text}
      </p>

      {/* Camera */}
      <div
        className={`relative mx-3 mt-2 min-h-0 flex-1 overflow-hidden rounded-3xl bg-black ring-4 transition-[box-shadow] duration-200 ${
          result ? (result.ok ? "ring-emerald-400" : "ring-red-500") : "ring-transparent"
        }`}
      >
        <div id={SCANNER_ELEMENT_ID} className="absolute inset-0" />

        {/* Aiming guide only: the whole view is scanned. */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
          <div className="relative aspect-square w-[68%] max-w-xs">
            <span className="absolute left-0 top-0 h-10 w-10 rounded-tl-2xl border-l-4 border-t-4 border-gold-400" />
            <span className="absolute right-0 top-0 h-10 w-10 rounded-tr-2xl border-r-4 border-t-4 border-gold-400" />
            <span className="absolute bottom-0 left-0 h-10 w-10 rounded-bl-2xl border-b-4 border-l-4 border-gold-400" />
            <span className="absolute bottom-0 right-0 h-10 w-10 rounded-br-2xl border-b-4 border-r-4 border-gold-400" />
          </div>
        </div>

        <p className="pointer-events-none absolute inset-x-0 top-3 text-center text-sm font-medium text-white drop-shadow">
          Point at the student&apos;s QR code
        </p>

        {!cameraReady && !cameraError && cameraOn && (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-white/70">Starting camera…</p>
        )}
        {cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-sm text-white/90">{cameraError}</p>
            <button onClick={() => setSheet("manual")} className="rounded-full bg-gold-400 px-5 py-2.5 text-sm font-semibold text-brand-800">
              Use manual entry
            </button>
          </div>
        )}

        {result && <ResultOverlay result={result} onDismiss={() => setResult(null)} />}
      </div>

      {/* Thumb-reach controls */}
      <div className="grid grid-cols-4 gap-2 px-3 py-3">
        <button onClick={() => setSheet("manual")} className={toolButton}>
          <span className="text-xl" aria-hidden="true">✍️</span>
          Manual
        </button>
        <button
          onClick={async () => {
            if (!torch) return;
            const next = !torch.on;
            try {
              await torch.apply(next);
              setTorch({ ...torch, on: next });
            } catch {
              setTorch(null);
            }
          }}
          disabled={!torch}
          aria-pressed={torch?.on ?? false}
          className={`${toolButton} ${torch?.on ? "!bg-gold-400 !text-brand-800" : ""}`}
        >
          <span className="text-xl" aria-hidden="true">🔦</span>
          {torch?.on ? "Light on" : "Light"}
        </button>
        <button onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))} className={toolButton}>
          <span className="text-xl" aria-hidden="true">🔄</span>
          Flip
        </button>
        <button onClick={() => setSheet("recent")} className={toolButton}>
          <span className="text-xl font-bold leading-none" aria-hidden="true">{recent.length}</span>
          Recent
        </button>
      </div>

      {sheet && (
        <BottomSheet title={sheet === "manual" ? "Manual entry" : "Recent on this phone"} onClose={() => setSheet(null)}>
          {sheet === "manual" ? (
            <>
              <ManualEntry
                eventDayId={day.id}
                defaultType={signOutState !== "not_open" ? "sign_out" : "sign_in"}
                onResult={(r) => {
                  showResult(r);
                  if (r.ok) setSheet(null);
                }}
              />
              {debugTools && <DebugTokenForm onSubmit={submitScan} />}
            </>
          ) : recent.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">No scans yet on this phone.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recent.map((r) => (
                <li key={r.key} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                  <span className="min-w-0 truncate">
                    <span className="font-medium text-slate-800">{r.name}</span>{" "}
                    <span className="text-slate-400">{r.studentId}</span>
                  </span>
                  <span className="shrink-0 text-xs text-slate-500">
                    {r.type === "sign_in" ? "In" : "Out"}
                    {r.manual && " · manual"} · {formatTime(r.at.toISOString())}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </BottomSheet>
      )}
    </div>
  );
}

// Big result card over the camera, so the layout never shifts and the name
// is readable at arm's length.
function ResultOverlay({ result, onDismiss }: { result: ScanResult; onDismiss: () => void }) {
  return (
    <button
      onClick={onDismiss}
      aria-live="assertive"
      className={`absolute inset-x-3 bottom-3 block rounded-2xl p-4 text-left shadow-2xl ${
        result.ok ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
      }`}
    >
      {result.ok && result.student ? (
        <>
          <p className="text-xs font-bold uppercase tracking-wide text-white/90">
            ✓ {result.type === "sign_in" ? "Signed in" : "Signed out"}
            {result.manual && " (manual)"}
          </p>
          <p className="mt-1 text-2xl font-bold leading-tight">{result.student.full_name}</p>
          <p className="mt-0.5 text-sm text-white/90">{describe(result.student)}</p>
          <p className="mt-2 text-[11px] text-white/80">Check that this is the person in front of you.</p>
        </>
      ) : (
        <>
          <p className="text-xs font-bold uppercase tracking-wide text-white/90">✕ Not recorded</p>
          <p className="mt-1 text-lg font-semibold leading-snug">{result.message}</p>
          <p className="mt-2 text-[11px] text-white/80">Tap to dismiss</p>
        </>
      )}
    </button>
  );
}

function BottomSheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end bg-black/50" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88vh] w-full overflow-y-auto rounded-t-3xl bg-white p-4 text-slate-900 shadow-2xl"
        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-200" aria-hidden="true" />
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-semibold text-brand-800">{title}</h2>
          <button onClick={onClose} className="min-h-10 rounded-full px-3 text-sm font-medium text-slate-500 hover:bg-slate-100">
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ManualEntry({
  eventDayId,
  defaultType,
  onResult,
}: {
  eventDayId: string;
  defaultType: AttendanceType;
  onResult: (r: ScanResult) => void;
}) {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<StudentInfo[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<StudentInfo | null>(null);
  const [type, setType] = useState<AttendanceType>(defaultType);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (selected || query.trim().length < 2) return;
    const controller = new AbortController();
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/students/search?q=${encodeURIComponent(query.trim())}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        setMatches(res.ok ? data.students : []);
      } catch {
        // aborted by a newer keystroke
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [query, selected]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected?.id) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/attendance/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventDayId, studentProfileId: selected.id, type, reason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not record attendance.");
        onResult({ ok: false, message: data.error ?? "Could not record attendance." });
        return;
      }
      onResult({ ok: true, message: "Recorded", student: data.student, type: data.type, manual: true });
      setSelected(null);
      setQuery("");
      setMatches([]);
      setReason("");
    } catch {
      setError("Network error — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4 rounded-xl border border-slate-200 border-t-4 border-t-gold-400 bg-white p-4">
      <p className="text-xs text-slate-500">
        For a student who is here but can&apos;t show a QR (dead phone, no GPS or signal). Every manual entry is
        flagged and logged with your name.
      </p>

      {selected ? (
        <div className="flex items-start justify-between gap-2 rounded-lg bg-slate-50 p-3">
          <div className="min-w-0">
            <p className="font-medium text-slate-900">{selected.full_name}</p>
            <p className="text-sm text-slate-500">{describe(selected)}</p>
          </div>
          <button type="button" onClick={() => setSelected(null)} className="text-sm text-slate-500 underline">
            Change
          </button>
        </div>
      ) : (
        <div>
          <label htmlFor="manual-search" className={labelClass}>
            Find student
          </label>
          <input
            id="manual-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Student ID or name"
            autoComplete="off"
            className={`${inputClass} mt-1`}
          />
          {query.trim().length >= 2 && (
            <ul className="mt-2 max-h-60 divide-y divide-slate-100 overflow-y-auto rounded-md border border-slate-200">
              {matches.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(s)}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                  >
                    <span className="font-medium text-slate-800">{s.full_name}</span>
                    <span className="ml-2 text-slate-400">{describe(s)}</span>
                  </button>
                </li>
              ))}
              {!searching && matches.length === 0 && (
                <li className="px-3 py-2 text-sm text-slate-400">No matching students.</li>
              )}
              {searching && matches.length === 0 && <li className="px-3 py-2 text-sm text-slate-400">Searching…</li>}
            </ul>
          )}
        </div>
      )}

      <fieldset>
        <legend className={labelClass}>Record</legend>
        <div className="mt-1 flex gap-2">
          {(["sign_in", "sign_out"] as const).map((t) => (
            <label
              key={t}
              className={`flex flex-1 cursor-pointer items-center justify-center rounded-md border px-3 py-2 text-sm font-medium ${
                type === t ? "border-brand-700 bg-brand-700 text-white" : "border-slate-300 text-slate-700"
              }`}
            >
              <input
                type="radio"
                name="type"
                value={t}
                checked={type === t}
                onChange={() => setType(t)}
                className="sr-only"
              />
              {t === "sign_in" ? "Sign in" : "Sign out"}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="manual-reason" className={labelClass}>
          Reason
        </label>
        <input
          id="manual-reason"
          required
          minLength={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Phone battery dead"
          className={`${inputClass} mt-1`}
        />
      </div>

      {error && <Alert kind="error">{error}</Alert>}

      <button type="submit" disabled={!selected || submitting} className={`${btnPrimary} w-full`}>
        {submitting ? "Recording..." : "Record attendance"}
      </button>
    </form>
  );
}

function DebugTokenForm({ onSubmit }: { onSubmit: (token: string) => Promise<boolean> }) {
  const [token, setToken] = useState("");
  const [submitting, setSubmitting] = useState(false);

  return (
    <details className="mt-4 rounded-lg border border-dashed border-slate-300 p-3">
      <summary className="cursor-pointer text-sm font-medium text-slate-600">
        Dev only: paste a code instead of scanning
      </summary>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!token.trim()) return;
          setSubmitting(true);
          await onSubmit(token.trim());
          setSubmitting(false);
          setToken("");
        }}
        className="mt-3 flex gap-2"
      >
        <input
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Paste the student's code"
          className={`${inputClass} flex-1`}
        />
        <button type="submit" disabled={submitting} className={btnSecondary}>
          {submitting ? "..." : "Submit"}
        </button>
      </form>
    </details>
  );
}
