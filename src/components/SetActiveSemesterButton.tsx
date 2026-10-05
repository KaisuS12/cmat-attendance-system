"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { btnSecondary } from "@/components/ui";

export function SetActiveSemesterButton({ semesterId }: { semesterId: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function activate() {
    setSaving(true);
    const res = await fetch(`/api/semesters/${semesterId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: true }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      window.alert(data.error ?? "Could not set the active semester.");
      return;
    }
    router.refresh();
  }

  return (
    <button onClick={activate} disabled={saving} className={`${btnSecondary} px-3 py-1.5 text-xs`}>
      {saving ? "Saving..." : "Set active"}
    </button>
  );
}
