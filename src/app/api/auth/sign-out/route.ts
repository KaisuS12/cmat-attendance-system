import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const REASONS = new Set(["deactivated", "noprofile"]);

// Server-side sign-out used when a section layout finds the account can't
// continue (deactivated, or no profile row). Redirects to the login page
// with a message.
export async function GET(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const reason = new URL(request.url).searchParams.get("reason");
  const target = new URL("/login", request.url);
  if (reason && REASONS.has(reason)) target.searchParams.set(reason, "1");
  return NextResponse.redirect(target);
}
