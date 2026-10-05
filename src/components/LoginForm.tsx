"use client";

import Image from "next/image";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { studentIdToEmail } from "@/lib/constants";
import { Alert, btnPrimary, inputClass, labelClass } from "@/components/ui";
import { APP_FULL_NAME } from "@/lib/brand";

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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-white via-brand-50/60 to-gold-100/70 px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <Image
            src="/brand/cmat-logo.png"
            alt="College of Management, Accountancy and Technology — Kabankalan Catholic College, Inc."
            width={160}
            height={162}
            className="h-32 w-32 object-contain drop-shadow-sm sm:h-40 sm:w-40"
            priority
          />
          <h1 className="mt-4 text-xl font-bold tracking-tight text-brand-800">{APP_FULL_NAME}</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to continue.</p>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="h-1 bg-gradient-to-r from-gold-500 via-gold-400 to-gold-300" aria-hidden="true" />
          <div className="p-6 sm:p-8">
          <div className="flex rounded-lg bg-brand-50 p-1 text-sm" role="tablist">
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
                  tab === t ? "bg-white font-semibold text-brand-800 shadow-sm ring-1 ring-gold-400" : "text-slate-500"
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
    </div>
  );
}
