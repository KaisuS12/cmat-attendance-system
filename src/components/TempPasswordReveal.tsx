"use client";

import { useState } from "react";

// Hidden-by-default temporary password with Show / Hide. Fetched from the
// server only when shown (and each view is audited there). Students who
// set their own password have nothing to show.
export function TempPasswordReveal({ studentId, hasTempPassword }: { studentId: string; hasTempPassword: boolean }) {
  const [password, setPassword] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!hasTempPassword) {
    return <span className="text-xs text-slate-400">Set their own password</span>;
  }

  async function show() {
    setError(null);
    if (password) {
      setVisible(true);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/students/${studentId}/temp-password`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Couldn't load the password.");
        return;
      }
      setPassword(data.password);
      setVisible(true);
    } catch {
      setError("Network error — try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <span className="inline-flex items-center gap-2">
        <code className="min-w-[6.5rem] rounded bg-slate-100 px-2 py-1 font-mono text-sm tracking-wide text-slate-900">
          {visible && password ? password : "••••••••••"}
        </code>
        <button
          type="button"
          onClick={() => (visible ? setVisible(false) : show())}
          disabled={loading}
          aria-label={visible ? "Hide temporary password" : "Show temporary password"}
          className="min-h-9 rounded-md px-2 text-xs font-medium text-slate-600 underline hover:text-slate-900 disabled:opacity-50"
        >
          {loading ? "…" : visible ? "Hide" : "Show"}
        </button>
        {visible && password && (
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(password).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              });
            }}
            className="min-h-9 rounded-md px-2 text-xs font-medium text-slate-600 underline hover:text-slate-900"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        )}
      </span>
      {error && <span className="max-w-[16rem] text-xs text-red-600">{error}</span>}
    </span>
  );
}
