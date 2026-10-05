import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/session";
import { AppHeader, HAS_BOTTOM_NAV, NAV } from "@/components/AppHeader";
import { BottomNav } from "@/components/AppNav";
import type { UserRole } from "@/types/database";

export type Section = "admin" | "officer" | "student" | "account";

const ROLE_HOME: Record<UserRole, string> = {
  admin: "/admin",
  officer: "/officer",
  student: "/student",
};

// Which sections each role may open. Admins also run events, so they get
// the officer section too; everyone has their account page.
const ALLOWED: Record<UserRole, Section[]> = {
  admin: ["admin", "officer", "account"],
  officer: ["officer", "account"],
  student: ["student", "account"],
};

// Shared shell for every signed-in section. It also guards the section:
// the profile is needed here for the header anyway, so checking access here
// (instead of in the proxy) saves a database round trip on every page.
// Data is still protected by RLS and requireRole() regardless.
export async function RoleLayout({ section, children }: { section: Section; children: React.ReactNode }) {
  const profile = await getCurrentProfile();

  if (!profile) redirect("/api/auth/sign-out?reason=noprofile");
  if (profile.is_active === false) redirect("/api/auth/sign-out?reason=deactivated");
  if (!ALLOWED[profile.role]?.includes(section)) redirect(ROLE_HOME[profile.role] ?? "/login");

  const bottomNav = HAS_BOTTOM_NAV[profile.role];

  return (
    <div className="flex min-h-full flex-1 flex-col bg-slate-50">
      <AppHeader profile={profile} />
      <main
        className={`mx-auto w-full max-w-4xl flex-1 px-4 py-5 sm:py-8 ${
          bottomNav ? "pb-[calc(5rem+env(safe-area-inset-bottom))] sm:pb-8" : ""
        }`}
      >
        {/* Changing a temporary password is optional, but encouraged: until it's
            changed, officers can still look the temporary one up. */}
        {profile.must_change_password === true && section !== "account" && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 print:hidden">
            <span>You&apos;re using a temporary password. Set your own to keep your account private.</span>
            <Link href="/account/password" className="font-semibold underline">
              Change password
            </Link>
          </div>
        )}
        {children}
      </main>
      {bottomNav && <BottomNav items={NAV[profile.role]} />}
    </div>
  );
}
