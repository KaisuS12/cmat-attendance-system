"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { btnDanger } from "@/components/ui";

// "Remove" for an old officer: deleted if they never did anything,
// otherwise deactivated and kept under "Former officers" (their name stays
// on the events and scans they handled).
export function RemoveStaffButton({ userId, name }: { userId: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/users/${userId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not remove the account.");
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

  return (
    <>
      <button
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className={`${btnDanger} min-h-9 px-3 py-1.5 text-xs`}
      >
        Remove
      </button>
      <ConfirmDialog
        open={open}
        title={`Remove ${name}?`}
        message={
          <>
            They can no longer log in. If they never handled an event, scan or other action, the account is deleted
            for good. Otherwise it&apos;s kept under <strong>Former officers</strong> so their name stays on the
            records they handled.
          </>
        }
        confirmLabel="Remove"
        danger
        busy={busy}
        error={error}
        onConfirm={remove}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
