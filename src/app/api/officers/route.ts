import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { generateTempPassword } from "@/lib/passwords";
import { parseJsonBody } from "@/lib/validation";

export async function GET() {
  const { error } = await requireRole("admin");
  if (error) return error;

  const admin = createAdminClient();
  const { data, error: queryError } = await admin
    .from("profiles")
    .select("*")
    .eq("role", "officer")
    .order("full_name");

  if (queryError) return NextResponse.json({ error: queryError.message }, { status: 500 });
  return NextResponse.json({ officers: data });
}

const bodySchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required."),
  email: z.email("Enter a valid email.").transform((e) => e.trim().toLowerCase()),
  role: z.enum(["officer", "admin"]).default("officer"),
});

// Officer/Admin accounts are keyed by official school email (§7 recommendation).
export async function POST(request: Request) {
  const { profile, error } = await requireRole("admin");
  if (error) return error;

  const body = await parseJsonBody(request, bodySchema);
  if (body.error) return body.error;
  const { fullName, email, role } = body.data;

  const admin = createAdminClient();
  const tempPassword = generateTempPassword();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
  });

  if (createError || !created.user) {
    const exists = createError?.code === "email_exists" || createError?.status === 422;
    return NextResponse.json(
      { error: exists ? "An account with this email already exists." : "Could not create the account." },
      { status: exists ? 409 : 500 }
    );
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: created.user.id,
    role,
    full_name: fullName,
    email,
    must_change_password: true,
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: "Could not create the account profile." }, { status: 500 });
  }

  await logAudit({
    actorId: profile.id,
    action: role === "admin" ? "admin_account_created" : "officer_account_created",
    entityType: "profiles",
    entityId: created.user.id,
    details: { email, fullName, role },
  });

  // Returned once, at creation time, so the admin can hand it to the officer
  // out of band — it is never stored or retrievable again after this response.
  return NextResponse.json({ email, tempPassword }, { status: 201 });
}
