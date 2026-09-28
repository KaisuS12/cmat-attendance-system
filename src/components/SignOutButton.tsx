"use client";

import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  return (
    <button
      onClick={async () => {
        await createClient().auth.signOut();
        window.location.href = "/login";
      }}
      className="text-sm font-medium text-slate-500 hover:text-slate-900"
    >
      Log out
    </button>
  );
}
