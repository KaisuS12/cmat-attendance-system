"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { btnDanger } from "@/components/ui";

export function DeleteEventButton({ eventId, title }: { eventId: string; title: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!window.confirm(`Delete “${title}”? This can't be undone.`)) return;
    setDeleting(true);
    const res = await fetch(`/api/events/${eventId}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      window.alert(data.error ?? "Could not delete the event.");
      setDeleting(false);
      return;
    }
    router.push("/officer");
    router.refresh();
  }

  return (
    <button onClick={handleDelete} disabled={deleting} className={btnDanger}>
      {deleting ? "Deleting..." : "Delete"}
    </button>
  );
}
