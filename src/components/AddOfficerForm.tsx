"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, btnPrimary, inputClass } from "@/components/ui";

export function AddOfficerForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"officer" | "admin">("officer");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ email: string; tempPassword: string; role: string } | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreated(null);
    setCreating(true);

    try {
      const res = await fetch("/api/officers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not create the account.");
        return;
      }
      setCreated({ ...data, role });
      setFullName("");
      setEmail("");
      setRole("officer");
      router.refresh();
    } catch {
      setError("Network error — try again.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <form onSubmit={handleCreate} className="mt-6 rounded-xl border border-slate-200 border-t-4 border-t-gold-400 bg-white p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-brand-800">Add account</h2>
      <div className="mt-3 flex rounded-lg bg-brand-50 p-1 text-sm" role="radiogroup" aria-label="Account type">
        {(["officer", "admin"] as const).map((r) => (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={role === r}
            onClick={() => setRole(r)}
            className={`min-h-9 flex-1 rounded-md font-medium transition ${
              role === r ? "bg-white font-semibold text-brand-800 shadow-sm ring-1 ring-gold-400" : "text-slate-500"
            }`}
          >
            {r === "officer" ? "Officer" : "Admin"}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {role === "officer"
          ? "Officers create events, scan attendance, export reports and reset student passwords."
          : "Admins can do everything officers can, plus manage accounts, semesters, imports and the audit log. Keep this to a few trusted people."}
      </p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <input
          required
          placeholder="Full name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className={inputClass}
        />
        <input
          required
          type="email"
          placeholder="School email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
        <button type="submit" disabled={creating} className={`${btnPrimary} shrink-0`}>
          {creating ? "Adding..." : "Add"}
        </button>
      </div>
      {error && (
        <div className="mt-3">
          <Alert kind="error">{error}</Alert>
        </div>
      )}
      {created && (
        <div className="mt-3">
          <Alert kind="success">
            {created.role === "admin" ? "Admin" : "Officer"} account created for <strong>{created.email}</strong>. Temporary password:{" "}
            <code className="rounded bg-emerald-100 px-1.5 py-0.5 font-semibold">{created.tempPassword}</code>
            <br />
            Share this privately — it won&apos;t be shown again. They&apos;ll set their own password on first login.
          </Alert>
        </div>
      )}
    </form>
  );
}
