import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Called once a day by Vercel Cron (see vercel.json). A free Supabase
// project pauses after 7 days without activity — e.g. over a semester break —
// and the site stops working until someone restores it. One small query a
// day keeps it active.
//
// Vercel sends "Authorization: Bearer <CRON_SECRET>" when the CRON_SECRET
// environment variable is set; anything else is rejected.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("semesters").select("id").limit(1);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, at: new Date().toISOString() });
}
