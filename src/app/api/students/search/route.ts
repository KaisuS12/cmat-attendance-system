import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

// Student lookup by ID or name — used by the scanner's manual-entry tab.
export async function GET(request: Request) {
  const { error } = await requireRole("officer", "admin");
  if (error) return error;

  const q = new URL(request.url).searchParams.get("q") ?? "";
  // Strip characters that have meaning inside a PostgREST or() filter.
  const term = q.replace(/[,()*%\\:"]/g, " ").trim();
  if (term.length < 2) return NextResponse.json({ students: [] });

  const admin = createAdminClient();
  const { data, error: queryError } = await admin
    .from("profiles")
    .select("id, student_id, full_name, program, year_level, section")
    .eq("role", "student")
    .or(`student_id.ilike.%${term}%,full_name.ilike.%${term}%`)
    .order("full_name")
    .limit(10);

  if (queryError) return NextResponse.json({ error: queryError.message }, { status: 500 });
  return NextResponse.json({ students: data });
}
