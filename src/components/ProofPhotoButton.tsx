"use client";

import { useRef, useState } from "react";
import { btnSecondary } from "@/components/ui";
import { formatDateTime } from "@/lib/datetime";

interface Proof {
  studentName: string;
  studentId: string | null;
  officerName: string;
  recordedAt: string;
  type: string;
  reason: string | null;
  url: string | null;
  message: string | null;
}

// Admins: opens a manual entry's ID photo next to the details to compare it with.
export function ProofPhotoButton({ recordId, className }: { recordId: string; className?: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [proof, setProof] = useState<Proof | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    setProof(null);
    setError(null);
    setLoading(true);
    dialogRef.current?.showModal();
    try {
      const res = await fetch(`/api/attendance/${recordId}/proof`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error ?? "Could not open the photo.");
      else setProof(data);
    } catch {
      setError("Network error — try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button type="button" onClick={open} className={className ?? "text-[11px] font-medium text-brand-700 underline"}>
        View ID photo
      </button>
      <dialog
        ref={dialogRef}
        // The link only lasts a minute, so nothing is kept after closing.
        onClose={() => setProof(null)}
        className="m-auto w-[min(94vw,32rem)] rounded-xl bg-white p-0 text-left text-slate-900 shadow-xl backdrop:bg-slate-900/40"
      >
        <div className="space-y-3 p-4">
          <h2 className="text-base font-semibold text-slate-900">ID photo for this manual entry</h2>
          {loading && <p className="py-8 text-center text-sm text-slate-500">Opening…</p>}
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          {proof && (
            <>
              {proof.url ? (
                // eslint-disable-next-line @next/next/no-img-element -- a private, short-lived link
                <img
                  src={proof.url}
                  alt={`ID photo for the manual entry of ${proof.studentName}`}
                  className="max-h-[55vh] w-full rounded-lg bg-black object-contain"
                />
              ) : (
                <p className="rounded-lg bg-slate-50 p-4 text-center text-sm text-slate-600">{proof.message}</p>
              )}
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
                <dt className="text-slate-500">Student</dt>
                <dd className="font-semibold text-slate-900">
                  {proof.studentName}
                  {proof.studentId && <span className="font-normal text-slate-500"> · {proof.studentId}</span>}
                </dd>
                <dt className="text-slate-500">Entry</dt>
                <dd className="text-slate-700">
                  Manual {proof.type === "sign_in" ? "sign in" : "sign out"} · {formatDateTime(proof.recordedAt)}
                </dd>
                <dt className="text-slate-500">Officer</dt>
                <dd className="text-slate-700">{proof.officerName}</dd>
                {proof.reason && (
                  <>
                    <dt className="text-slate-500">Reason</dt>
                    <dd className="text-slate-700">{proof.reason}</dd>
                  </>
                )}
              </dl>
              {proof.url && (
                <p className="text-xs text-slate-500">Check that the name on the ID matches the student above.</p>
              )}
            </>
          )}
          <button type="button" onClick={() => dialogRef.current?.close()} className={`${btnSecondary} w-full`}>
            Close
          </button>
        </div>
      </dialog>
    </>
  );
}
