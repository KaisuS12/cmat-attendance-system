"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { btnDanger, btnSecondary } from "@/components/ui";

// Admin actions on a student or officer account: reset password (shows the
// new temporary password once) and deactivate / reactivate.
export function AccountActions({ userId, name, isActive }: { userId: string; name: string; isActive: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function resetPassword() {
    if (!window.confirm(`Reset the password for ${name}? Their current password will stop working.`)) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/users/${userId}/reset-password`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Could not reset the password.");
      return;
    }
    setTempPassword(data.tempPassword);
    router.refresh();
  }

  async function setActive(active: boolean) {
    if (!active && !window.confirm(`Deactivate ${name}? They won't be able to log in until reactivated.`)) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/users/${userId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Could not update the account.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        <button onClick={resetPassword} disabled={busy} className={`${btnSecondary} px-3 py-1.5 text-xs`}>
          Reset password
        </button>
        {isActive ? (
          <button onClick={() => setActive(false)} disabled={busy} className={`${btnDanger} px-3 py-1.5 text-xs`}>
            Deactivate
          </button>
        ) : (
          <button onClick={() => setActive(true)} disabled={busy} className={`${btnSecondary} px-3 py-1.5 text-xs`}>
            Reactivate
          </button>
        )}
      </div>
      {tempPassword && (
        <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          New temporary password:{" "}
          <code className="rounded bg-emerald-100 px-1.5 py-0.5 font-semibold">{tempPassword}</code>
          <span className="block text-xs">Share it privately — it won&apos;t be shown again.</span>
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
