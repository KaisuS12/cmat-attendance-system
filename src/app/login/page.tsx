"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { studentIdToEmail } from "@/lib/constants";

export default function LoginPage() {
  const [tab, setTab] = useState<"student" | "staff">("student");
  const [studentId, setStudentId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const loginEmail = tab === "student" ? studentIdToEmail(studentId) : email;

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password,
    });

    setLoading(false);

    if (authError) {
      setError(
        authError.code === "email_not_confirmed"
          ? "This account's email hasn't been confirmed yet. In Supabase → Authentication → Users, open this user and confirm their email, then try again."
          : "Incorrect credentials. Please try again."
      );
      return;
    }

    // Full navigation (not router.refresh()) so proxy.ts re-runs server-side
    // and redirects to the right role home — also sidesteps a Turbopack dev
    // quirk where the RSC refresh fetch intermittently fails right after auth.
    window.location.href = "/";
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">CMAT Council Attendance</h1>
        <p className="mt-1 text-sm text-slate-500">Sign in to continue.</p>

        <div className="mt-6 flex rounded-lg bg-slate-100 p-1 text-sm">
          <button
            type="button"
            onClick={() => setTab("student")}
            className={`flex-1 rounded-md py-1.5 font-medium transition ${
              tab === "student" ? "bg-white shadow-sm" : "text-slate-500"
            }`}
          >
            Student
          </button>
          <button
            type="button"
            onClick={() => setTab("staff")}
            className={`flex-1 rounded-md py-1.5 font-medium transition ${
              tab === "staff" ? "bg-white shadow-sm" : "text-slate-500"
            }`}
          >
            Officer / Admin
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {tab === "student" ? (
            <div>
              <label className="block text-sm font-medium text-slate-700">Student ID</label>
              <input
                required
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                placeholder="e.g. 21-00123"
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-slate-700">School email</label>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                placeholder="you@school.edu.ph"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700">Password</label>
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-slate-900 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
