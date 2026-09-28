"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Profile } from "@/types/database";

export default function OfficersPage() {
  const [officers, setOfficers] = useState<Profile[]>([]);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ email: string; tempPassword: string } | null>(null);

  async function load() {
    const res = await fetch("/api/officers");
    const data = await res.json();
    if (res.ok) setOfficers(data.officers);
  }

  useEffect(() => {
    let ignore = false;
    fetch("/api/officers")
      .then((res) => res.json())
      .then((data) => {
        if (!ignore) setOfficers(data.officers ?? []);
      });
    return () => {
      ignore = true;
    };
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    setCreated(null);

    const res = await fetch("/api/officers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, email }),
    });
    const data = await res.json();

    setCreating(false);

    if (!res.ok) {
      setError(data.error ?? "Could not create officer.");
      return;
    }

    setCreated(data);
    setFullName("");
    setEmail("");
    load();
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/admin" className="text-sm text-slate-500 hover:text-slate-900">
        ← Back
      </Link>
      <h1 className="mt-2 text-xl font-semibold text-slate-900">Officer Accounts</h1>

      <form onSubmit={handleCreate} className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-medium text-slate-700">Add officer</h2>
        <div className="mt-3 flex gap-3">
          <input
            required
            placeholder="Full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            required
            type="email"
            placeholder="School email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={creating}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {creating ? "Adding..." : "Add"}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        {created && (
          <div className="mt-3 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">
            Account created for <strong>{created.email}</strong>. Temporary password:{" "}
            <code className="rounded bg-emerald-100 px-1.5 py-0.5">{created.tempPassword}</code>
            <br />
            Share this with them securely — it will not be shown again.
          </div>
        )}
      </form>

      <div className="mt-6 space-y-2">
        {officers.map((o) => (
          <div key={o.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
            <p className="font-medium text-slate-800">{o.full_name}</p>
          </div>
        ))}
        {officers.length === 0 && <p className="text-sm text-slate-500">No officers yet.</p>}
      </div>
    </div>
  );
}
