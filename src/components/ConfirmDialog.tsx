"use client";

import { useEffect, useRef, useState } from "react";
import { btnDanger, btnPrimary, btnSecondary, inputClass } from "@/components/ui";

// In-app replacement for window.confirm(): works the same on every phone,
// can ask for a reason, and shows server errors without closing.
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  danger = false,
  reasonLabel,
  busy = false,
  error,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  /** When set, a required reason field is shown and passed to onConfirm. */
  reasonLabel?: string;
  busy?: boolean;
  error?: string | null;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const needsReason = Boolean(reasonLabel);
  const canConfirm = !busy && (!needsReason || reason.trim().length >= 3);

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onCancel();
      }}
      onClose={() => setReason("")}
      className="m-auto w-[min(92vw,26rem)] rounded-xl p-0 shadow-xl backdrop:bg-slate-900/40"
    >
      <form
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault();
          if (canConfirm) onConfirm(reason.trim());
        }}
        className="space-y-4 p-5"
      >
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {message && <div className="text-sm text-slate-600">{message}</div>}
        {needsReason && (
          <label className="block text-sm font-medium text-slate-700">
            {reasonLabel}
            <input
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              minLength={3}
              required
              className={`${inputClass} mt-1`}
            />
          </label>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} disabled={busy} className={btnSecondary}>
            Cancel
          </button>
          <button type="submit" disabled={!canConfirm} className={danger ? btnDanger : btnPrimary}>
            {busy ? "Working..." : confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}
