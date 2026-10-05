"use client";

import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  return (
    <button
      onClick={async () => {
        await createClient().auth.signOut();
        // Full navigation so no signed-in RSC payload survives in the router cache.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full load is intended (see comment above)
        window.location.assign("/login");
      }}
      className="text-sm font-medium text-slate-500 hover:text-slate-900"
    >
      Log out
    </button>
  );
}
