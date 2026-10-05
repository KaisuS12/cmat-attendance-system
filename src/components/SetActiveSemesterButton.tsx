"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { btnSecondary } from "@/components/ui";

export function SetActiveSemesterButton({ semesterId }: { semesterId: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function activate() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/semesters/${semesterId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: true }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not set the active semester.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error — try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button onClick={activate} disabled={saving} className={`${btnSecondary} min-h-9 px-3 py-1.5 text-xs`}>
        {saving ? "Saving..." : "Set active"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
