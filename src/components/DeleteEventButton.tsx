"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { btnDanger } from "@/components/ui";

export function DeleteEventButton({ eventId, title }: { eventId: string; title: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${eventId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not delete the event.");
        return;
      }
      router.push("/officer");
      router.refresh();
    } catch {
      setError("Network error — try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <button
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className={btnDanger}
      >
        Delete
      </button>
      <ConfirmDialog
        open={open}
        title={`Delete “${title}”?`}
        message="The event and all its days are removed. This can't be undone."
        confirmLabel="Delete event"
        danger
        busy={deleting}
        error={error}
        onConfirm={handleDelete}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
