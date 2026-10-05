"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PrintSlipsButton } from "@/components/CredentialSlips";
import { btnDanger, btnSecondary } from "@/components/ui";
import type { SlipCredential } from "@/lib/slips";

type Pending = "reset" | "deactivate" | null;

// Account actions on a student or officer: reset password (shows the new
// temporary password once, printable as a slip for students) and — for
// admins — deactivate / reactivate.
export function AccountActions({
  userId,
  name,
  isActive,
  canDeactivate = true,
  slip,
}: {
  userId: string;
  name: string;
  isActive: boolean;
  canDeactivate?: boolean;
  /** Student details for a printable slip after a reset. */
  slip?: Omit<SlipCredential, "tempPassword" | "fullName">;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function resetPassword() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/users/${userId}/reset-password`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not reset the password.");
        return;
      }
      setTempPassword(data.tempPassword);
      setPending(null);
      router.refresh();
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  async function setActive(active: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/users/${userId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not update the account.");
        return;
      }
      setPending(null);
      router.refresh();
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  const small = "min-h-9 px-3 py-1.5 text-xs";

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        <button
          onClick={() => {
            setError(null);
            setPending("reset");
          }}
          disabled={busy}
          className={`${btnSecondary} ${small}`}
        >
          Reset password
        </button>
        {canDeactivate &&
          (isActive ? (
            <button
              onClick={() => {
                setError(null);
                setPending("deactivate");
              }}
              disabled={busy}
              className={`${btnDanger} ${small}`}
            >
              Deactivate
            </button>
          ) : (
            <button onClick={() => setActive(true)} disabled={busy} className={`${btnSecondary} ${small}`}>
              Reactivate
            </button>
          ))}
      </div>

      {tempPassword && (
        <div className="w-full max-w-xs rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          New temporary password for {name}:{" "}
          <code className="rounded bg-emerald-100 px-1.5 py-0.5 font-semibold">{tempPassword}</code>
          <span className="block text-xs">Share it privately — it won&apos;t be shown again.</span>
          {slip && (
            <PrintSlipsButton
              label="Print slip"
              className={`${btnSecondary} mt-2 ${small}`}
              credentials={[{ ...slip, fullName: name, tempPassword }]}
            />
          )}
        </div>
      )}
      {error && pending === null && <p className="text-xs text-red-600">{error}</p>}

      <ConfirmDialog
        open={pending === "reset"}
        title={`Reset ${name}'s password?`}
        message="Their current password stops working. They'll get a temporary password and must set a new one on their next login."
        confirmLabel="Reset password"
        busy={busy}
        error={error}
        onConfirm={resetPassword}
        onCancel={() => setPending(null)}
      />
      <ConfirmDialog
        open={pending === "deactivate"}
        title={`Deactivate ${name}?`}
        message="They're signed out and can't log in until reactivated. Their attendance history is kept."
        confirmLabel="Deactivate"
        danger
        busy={busy}
        error={error}
        onConfirm={() => setActive(false)}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
