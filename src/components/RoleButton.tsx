"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { btnSecondary } from "@/components/ui";

// "Make admin" / "Make officer" for a staff account, with confirmation.
export function RoleButton({ userId, name, role }: { userId: string; name: string; role: "admin" | "officer" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const next = role === "admin" ? "officer" : "admin";

  async function change() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not change the role.");
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
        className={`${btnSecondary} min-h-9 px-3 py-1.5 text-xs`}
      >
        {next === "admin" ? "Make admin" : "Make officer"}
      </button>
      <ConfirmDialog
        open={open}
        title={next === "admin" ? `Make ${name} an admin?` : `Make ${name} an officer?`}
        message={
          next === "admin"
            ? "Admins can manage all accounts, reset passwords, void records, import students and see the audit log."
            : "They'll keep officer access (events, scanning, reports) but lose admin pages."
        }
        confirmLabel={next === "admin" ? "Make admin" : "Make officer"}
        busy={busy}
        error={error}
        onConfirm={change}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
