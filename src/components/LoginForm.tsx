"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { studentIdToEmail } from "@/lib/constants";
import { Alert, btnPrimary, inputClass, labelClass } from "@/components/ui";

export function LoginForm({ notice }: { notice: string | null }) {
  const [tab, setTab] = useState<"student" | "staff">("student");
  const [studentId, setStudentId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(notice);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const loginEmail = tab === "student" ? studentIdToEmail(studentId) : email.trim();

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password,
    });

    if (authError) {
      setLoading(false);
      setError(
        authError.code === "user_banned"
          ? "This account has been deactivated. Contact the council admin."
          : authError.code === "email_not_confirmed"
          ? "This account isn't activated yet. Contact the council admin."
          : authError.status === 429
          ? "Too many attempts. Wait a minute and try again."
          : tab === "student"
          ? "Incorrect student ID or password."
          : "Incorrect email or password."
      );
      return;
    }

    // Full navigation (not router.refresh()) so proxy.ts re-runs server-side
    // and redirects to the right role home — also sidesteps a Turbopack dev
    // quirk where the RSC refresh fetch intermittently fails right after auth.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full load is intended (see comment above)
    window.location.assign("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-lg font-bold text-white">
            C
          </span>
          <h1 className="mt-3 text-xl font-semibold text-slate-900">CMAT Council Attendance</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to continue.</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex rounded-lg bg-slate-100 p-1 text-sm" role="tablist">
            {(["student", "staff"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => {
                  setTab(t);
                  setError(null);
                }}
                className={`flex-1 rounded-md py-1.5 font-medium transition ${
                  tab === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                }`}
              >
                {t === "student" ? "Student" : "Officer / Admin"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {tab === "student" ? (
              <div>
                <label htmlFor="studentId" className={labelClass}>
                  Student ID
                </label>
                <input
                  id="studentId"
                  required
                  autoComplete="username"
                  autoCapitalize="none"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  className={`${inputClass} mt-1`}
                  placeholder="e.g. 21-00123"
                />
              </div>
            ) : (
              <div>
                <label htmlFor="email" className={labelClass}>
                  School email
                </label>
                <input
                  id="email"
                  required
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`${inputClass} mt-1`}
                  placeholder="you@school.edu.ph"
                />
              </div>
            )}

            <div>
              <label htmlFor="password" className={labelClass}>
                Password
              </label>
              <input
                id="password"
                required
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${inputClass} mt-1`}
              />
            </div>

            {error && <Alert kind="error">{error}</Alert>}

            <button type="submit" disabled={loading} className={`${btnPrimary} w-full`}>
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-slate-400">
            Forgot your password? Ask a council officer or admin to reset it.
          </p>
        </div>
      </div>
    </div>
  );
}
