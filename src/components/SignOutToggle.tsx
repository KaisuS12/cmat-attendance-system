"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { btnSecondary } from "@/components/ui";

// For a late announcement ("no sign-out today"): everyone who already signed
// in counts as present right away, and sign-out QR codes are refused.
// Reversible.
export function SignOutToggle({
  eventId,
  dayId,
  label,
  required,
  canRestore,
}: {
  eventId: string;
  dayId: string;
  label: string;
  required: boolean;
  canRestore: boolean; // a session created as sign-in only has no sign-out times to go back to
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function set(next: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/days/${dayId}/sign-out`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ required: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not update.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!required) {
    return canRestore ? (
      <button onClick={() => set(true)} disabled={busy} className={`${btnSecondary} px-2.5 py-1 text-xs`}>
        {busy ? "Saving…" : "Turn sign-out back on"}
      </button>
    ) : null;
  }

  return (
    <>
      <button
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className={`${btnSecondary} px-2.5 py-1 text-xs`}
      >
        Cancel sign-out
      </button>
      <ConfirmDialog
        open={open}
        title={`No sign-out for ${label}?`}
        message="Everyone who signed in counts as present right away, and students can no longer make a sign-out QR. You can turn sign-out back on later."
        confirmLabel="Cancel sign-out"
        busy={busy}
        error={error}
        onConfirm={() => set(false)}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
