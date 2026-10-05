"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
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

  const [tab, setTab] = useState<"scan" | "manual">("scan");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
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
        ].slice(0, 10)
      );
    }
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    clearTimerRef.current = setTimeout(() => setResult(null), r.ok ? 4000 : 6000);
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

  // Camera lifecycle. Only runs while the scan tab is open, so switching to
  // manual entry releases the camera.
  useEffect(() => {
    if (tab !== "scan") return;
    let cancelledBeforeStart = false;
    const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: (w, h) => ({ width: Math.min(w, h) * 0.75, height: Math.min(w, h) * 0.75 }) },
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
        // The effect was cleaned up (e.g. tab switch) before start() resolved —
        // stop it now that it's actually running, since the cleanup couldn't yet.
        if (cancelledBeforeStart) {
          scanner.stop().catch(() => {});
          return;
        }
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
        setCameraError(
          "Couldn't open the camera. Allow camera access for this site (the page must be on HTTPS), or use Manual entry."
        )
      );

    return () => {
      cancelledBeforeStart = true;
      // stop() throws synchronously (not a rejected Promise) if scanning
      // hasn't actually started yet, so only call it once isScanning is true.
      if (scanner.isScanning) scanner.stop().catch(() => {});
      setTorch(null);
    };
  }, [tab, submitScan]);

  return (
    <div className="mx-auto max-w-md">
      <Link href={`/officer/events/${eventId}`} className="text-sm text-slate-500 hover:text-slate-900">
        ← {eventTitle}
      </Link>

      <div className="mt-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-slate-900">{formatDayDate(day.day_date, "long")}</h1>
          <p className="truncate text-sm text-slate-500">{venueName}</p>
        </div>
        <div className="flex shrink-0 gap-3 text-center">
          <div>
            <p className="text-xl font-semibold tabular-nums text-slate-900">{counts.sign_in}</p>
            <p className="text-[10px] uppercase tracking-wide text-slate-400">In</p>
          </div>
          <div>
            <p className="text-xl font-semibold tabular-nums text-slate-900">{counts.sign_out}</p>
            <p className="text-[10px] uppercase tracking-wide text-slate-400">Out</p>
          </div>
        </div>
      </div>

      <p
        className={`mt-3 rounded-md px-3 py-1.5 text-sm font-medium ${
          windowLabel.tone === "open" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"
        }`}
      >
        {windowLabel.text}
      </p>

      <div className="mt-4 flex rounded-lg bg-brand-50 p-1 text-sm" role="tablist">
        {(["scan", "manual"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`min-h-10 flex-1 rounded-md font-medium transition ${
              tab === t ? "bg-white font-semibold text-brand-800 shadow-sm ring-1 ring-gold-400" : "text-slate-500"
            }`}
          >
            {t === "scan" ? "Scan QR" : "Manual entry"}
          </button>
        ))}
      </div>

      {result && <ResultCard result={result} onDismiss={() => setResult(null)} />}

      {tab === "scan" ? (
        <>
          {cameraError && (
            <div className="mt-4">
              <Alert kind="error">{cameraError}</Alert>
            </div>
          )}
          <div className="relative -mx-4 mt-4 sm:mx-0">
            <div id={SCANNER_ELEMENT_ID} className="overflow-hidden bg-black sm:rounded-xl" />
            {torch && (
              <button
                type="button"
                onClick={async () => {
                  const next = !torch.on;
                  try {
                    await torch.apply(next);
                    setTorch({ ...torch, on: next });
                  } catch {
                    setTorch(null);
                  }
                }}
                aria-pressed={torch.on}
                className={`absolute right-3 top-3 min-h-11 rounded-full px-4 text-sm font-medium shadow ${
                  torch.on ? "bg-amber-300 text-slate-900" : "bg-white/90 text-slate-800"
                }`}
              >
                {torch.on ? "Light on" : "Light"}
              </button>
            )}
          </div>
          <p className="mt-3 text-center text-xs text-slate-500">
            Check that the name shown matches the person in front of you.
          </p>
          {debugTools && <DebugTokenForm onSubmit={submitScan} />}
        </>
      ) : (
        <ManualEntry
          eventDayId={day.id}
          defaultType={signOutState !== "not_open" ? "sign_out" : "sign_in"}
          onResult={showResult}
        />
      )}

      {recent.length > 0 && (
        <div className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Recent on this device</h2>
          <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {recent.map((r) => (
              <li key={r.key} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
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
        </div>
      )}
    </div>
  );
}

function ResultCard({ result, onDismiss }: { result: ScanResult; onDismiss: () => void }) {
  return (
    <button
      onClick={onDismiss}
      aria-live="assertive"
      className={`mt-4 block w-full rounded-xl border-2 p-4 text-left ${
        result.ok ? "border-emerald-400 bg-emerald-50" : "border-red-300 bg-red-50"
      }`}
    >
      {result.ok && result.student ? (
        <>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            ✓ {result.type === "sign_in" ? "Signed in" : "Signed out"}
            {result.manual && " (manual)"}
          </p>
          <p className="mt-1 text-2xl font-semibold leading-tight text-emerald-900">{result.student.full_name}</p>
          <p className="mt-0.5 text-sm text-emerald-800">{describe(result.student)}</p>
        </>
      ) : (
        <>
          <p className="text-xs font-semibold uppercase tracking-wide text-red-700">✕ Not recorded</p>
          <p className="mt-1 text-base font-medium text-red-800">{result.message}</p>
        </>
      )}
    </button>
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
    <form onSubmit={handleSubmit} className="mt-4 space-y-4 rounded-xl border border-slate-200 bg-white p-4">
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
