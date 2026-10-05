"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, btnPrimary, btnSecondary, inputClass } from "@/components/ui";
import type { Profile } from "@/types/database";

export function EditStudentForm({ student }: { student: Profile }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState(student.full_name);
  const [studentId, setStudentId] = useState(student.student_id ?? "");
  const [program, setProgram] = useState(student.program ?? "");
  const [yearLevel, setYearLevel] = useState(student.year_level ?? "");
  const [section, setSection] = useState(student.section ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const idChanged = studentId.trim() !== (student.student_id ?? "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/students/${student.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          program,
          yearLevel,
          section,
          ...(idChanged ? { studentId } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not save.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Network error — try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className={`${btnSecondary} px-3 py-1.5 text-xs`}>
        Edit details
      </button>
    );
  }

  const field = (label: string, value: string, set: (v: string) => void, required = false) => (
    <label className="text-xs font-medium text-slate-500">
      {label}
      <input required={required} value={value} onChange={(e) => set(e.target.value)} className={`${inputClass} mt-1`} />
    </label>
  );

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-3 rounded-xl border border-slate-200 border-t-4 border-t-gold-400 bg-white p-4">
      <h2 className="text-sm font-semibold text-brand-800">Edit student</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {field("Full name", fullName, setFullName, true)}
        {field("Student ID", studentId, setStudentId, true)}
        {field("Program", program, setProgram)}
        {field("Year level", yearLevel, setYearLevel)}
        {field("Section", section, setSection)}
      </div>
      {idChanged && (
        <Alert kind="info">
          Changing the student ID also changes their <strong>login</strong>. Tell the student to log in with the new
          ID (their password stays the same).
        </Alert>
      )}
      {error && <Alert kind="error">{error}</Alert>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className={btnPrimary}>
          {saving ? "Saving..." : "Save"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={btnSecondary}>
          Cancel
        </button>
      </div>
    </form>
  );
}
