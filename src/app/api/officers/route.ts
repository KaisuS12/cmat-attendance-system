import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("*")
    .eq("role", "officer")
    .order("full_name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ officers: data });
}

const bodySchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
});

function generateTempPassword() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

// Officer/Admin accounts are keyed by official school email (§7 recommendation).
export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { fullName, email } = parsed.data;

  const admin = createAdminClient();
  const tempPassword = generateTempPassword();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
  });

  if (createError || !created.user) {
    return NextResponse.json(
      { error: createError?.message ?? "Could not create officer account." },
      { status: 500 }
    );
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: created.user.id,
    role: "officer",
    full_name: fullName,
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: "Could not create officer profile." }, { status: 500 });
  }

  await logAudit({
    actorId: profile.id,
    action: "officer_account_created",
    entityType: "profiles",
    entityId: created.user.id,
    details: { email, fullName },
  });

  // Returned once, at creation time, so the admin can hand it to the officer
  // out of band — it is never stored or retrievable again after this response.
  return NextResponse.json({ email, tempPassword }, { status: 201 });
}
