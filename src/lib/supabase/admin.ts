import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service-role client — bypasses RLS entirely. Server-only: never import this
// from a Client Component or expose SUPABASE_SERVICE_ROLE_KEY to the browser.
// Used for the writes that must be trusted (attendance, audit log, QR token
// issuance) because the geofence/window/single-use checks already happened
// in the API route, not in the client.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
