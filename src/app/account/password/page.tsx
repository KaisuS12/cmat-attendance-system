"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MIN_PASSWORD_LENGTH } from "@/lib/constants";
import { Alert, btnPrimary, cardClass, inputClass, labelClass, PageTitle } from "@/components/ui";

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("The new passwords don't match.");
      return;
    }
    if (newPassword === currentPassword) {
      setError("Choose a password different from your current one.");
      return;
    }

    setSaving(true);
    const supabase = createClient();

    // Confirm the current password first, so an unattended signed-in device
    // can't be used to take over the account.
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) {
      setSaving(false);
      setError("Your session has expired. Please log in again.");
      return;
    }
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (verifyError) {
      setSaving(false);
      setError("Your current password is incorrect.");
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) {
      setSaving(false);
      setError(updateError.message);
      return;
    }

    await fetch("/api/account/password-changed", { method: "POST" });

    // Full navigation so the proxy re-reads the cleared flag and routes home.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full load is intended (see comment above)
    window.location.assign("/");
  }

  return (
    <div className="mx-auto max-w-md">
      <PageTitle
        title="Change password"
        subtitle="If you were given a temporary password, set your own before continuing."
      />

      <form onSubmit={handleSubmit} className={`${cardClass} mt-6 space-y-4`}>
        <div>
          <label htmlFor="current" className={labelClass}>
            Current (or temporary) password
          </label>
          <input
            id="current"
            required
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className={`${inputClass} mt-1`}
          />
        </div>
        <div>
          <label htmlFor="new" className={labelClass}>
            New password
          </label>
          <input
            id="new"
            required
            type="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={`${inputClass} mt-1`}
          />
          <p className="mt-1 text-xs text-slate-400">At least {MIN_PASSWORD_LENGTH} characters.</p>
        </div>
        <div>
          <label htmlFor="confirm" className={labelClass}>
            Confirm new password
          </label>
          <input
            id="confirm"
            required
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={`${inputClass} mt-1`}
          />
        </div>

        {error && <Alert kind="error">{error}</Alert>}

        <button type="submit" disabled={saving} className={`${btnPrimary} w-full`}>
          {saving ? "Saving..." : "Save new password"}
        </button>
      </form>
    </div>
  );
}
