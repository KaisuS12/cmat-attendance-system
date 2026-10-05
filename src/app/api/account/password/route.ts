import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { MIN_PASSWORD_LENGTH } from "@/lib/constants";
import { parseJsonBody } from "@/lib/validation";

const bodySchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: z.string().min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`),
  })
  .refine((b) => b.newPassword !== b.currentPassword, {
    path: ["newPassword"],
    message: "Choose a password different from your current one.",
  });

// Verifying the current password, setting the new one and clearing the
// forced-change flag all happen here, server-side, in one step. Clearing the
// flag on its own (without a real password change) is not possible.
export async function POST(request: Request) {
  const { profile, error } = await requireRole();
  if (error) return error;

  const body = await parseJsonBody(request, bodySchema);
  if (body.error) return body.error;
  const { currentPassword, newPassword } = body.data;

  const admin = createAdminClient();
  const { data: authUser } = await admin.auth.admin.getUserById(profile.id);
  const email = authUser.user?.email;
  if (!email) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  // A throwaway client with no cookies, so checking the password doesn't
  // touch the caller's session.
  const verifier = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { error: verifyError } = await verifier.auth.signInWithPassword({ email, password: currentPassword });
  if (verifyError) {
    return NextResponse.json(
      {
        error:
          verifyError.status === 429
            ? "Too many attempts. Wait a minute and try again."
            : "Your current password is incorrect.",
      },
      { status: verifyError.status === 429 ? 429 : 400 }
    );
  }
  await verifier.auth.signOut();

  const { error: updateError } = await admin.auth.admin.updateUserById(profile.id, { password: newPassword });
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  await admin.from("profiles").update({ must_change_password: false }).eq("id", profile.id);

  await logAudit({
    actorId: profile.id,
    action: "password_changed",
    entityType: "profiles",
    entityId: profile.id,
  });

  return NextResponse.json({ ok: true });
}
