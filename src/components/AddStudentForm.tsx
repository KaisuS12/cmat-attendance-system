"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { generatedIdPrefix, isValidStudentId, normalizeStudentId, STUDENT_ID_PATTERN } from "@/lib/constants";
import { PrintSlipsButton } from "@/components/CredentialSlips";
import { Alert, btnPrimary, btnSecondary, inputClass } from "@/components/ui";
import type { SlipCredential } from "@/lib/slips";

const EMPTY = { studentId: "", fullName: "", program: "", yearLevel: "" };

// Create one student account without a CSV — for testing, late enrollees,
// or transferees. Uses the same import endpoint as the masterlist upload.
export function AddStudentForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<SlipCredential | null>(null);

  const set = (key: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreated(null);

    const studentId = normalizeStudentId(form.studentId);
    if (studentId && !isValidStudentId(studentId)) {
      setError(`Student ID should match the format ${STUDENT_ID_PATTERN.source} (e.g. 21-00123).`);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/students/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ students: [{ ...form, studentId }] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not create the account.");
        return;
      }
      const result = data.results?.[0];
      if (result?.status === "exists") {
        setError(
          studentId
            ? "A student with this ID already has an account. Search for them below to reset their password."
            : `${form.fullName.trim()} (${[form.program, form.yearLevel].filter(Boolean).join(" ")}) already has an account (${result.studentId}). Search for them below to reset their password.`
        );
        return;
      }
      if (result?.status !== "created") {
        setError(result?.error ?? "Could not create the account.");
        return;
      }
      setCreated({
        studentId: result.studentId,
        fullName: form.fullName.trim(),
        tempPassword: result.tempPassword,
        program: form.program,
        yearLevel: form.yearLevel,
      });
      setForm(EMPTY);
      router.refresh();
    } catch {
      setError("Network error — try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className={btnSecondary}>
        + Add student
      </button>
    );
  }

  return (
    <div className="w-full rounded-xl border border-slate-200 border-t-4 border-t-gold-400 bg-white p-4 sm:p-5">
      <form onSubmit={handleSubmit} className="space-y-3">
        <h2 className="text-sm font-semibold text-brand-800">Add a student</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium text-slate-500">
            Student ID <span className="font-normal text-slate-400">(blank = auto)</span>
            <input
              value={form.studentId}
              onChange={set("studentId")}
              placeholder={`e.g. 21-00123 or leave blank for ${generatedIdPrefix()}…`}
              autoCapitalize="none"
              className={`${inputClass} mt-1`}
            />
          </label>
          <label className="text-xs font-medium text-slate-500">
            Full name
            <input required value={form.fullName} onChange={set("fullName")} className={`${inputClass} mt-1`} />
          </label>
          <label className="text-xs font-medium text-slate-500">
            Program
            <input value={form.program} onChange={set("program")} placeholder="BSTM" className={`${inputClass} mt-1`} />
          </label>
          <label className="text-xs font-medium text-slate-500">
            Year level
            <input value={form.yearLevel} onChange={set("yearLevel")} placeholder="1" className={`${inputClass} mt-1`} />
          </label>
        </div>
        <p className="text-xs text-slate-400">
          Use the same program and year spelling as the masterlist so event targeting matches.
        </p>

        {error && <Alert kind="error">{error}</Alert>}

        <div className="flex gap-2">
          <button type="submit" disabled={saving} className={btnPrimary}>
            {saving ? "Creating..." : "Create account"}
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setError(null);
              setCreated(null);
            }}
            className={btnSecondary}
          >
            Close
          </button>
        </div>
      </form>

      {created && (
        <div className="mt-4">
          <Alert kind="success">
            Account created for <strong>{created.fullName}</strong>. They log in on the <strong>Student</strong> tab
            with ID <code className="font-semibold">{created.studentId}</code> and temporary password{" "}
            <code className="rounded bg-emerald-100 px-1.5 py-0.5 font-semibold">{created.tempPassword}</code>, then
            set their own password. It won&apos;t be shown again.
            <div className="mt-2">
              <PrintSlipsButton label="Print slip" credentials={[created]} />
            </div>
          </Alert>
        </div>
      )}
    </div>
  );
}
