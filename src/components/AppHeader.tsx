import Link from "next/link";
import type { Profile } from "@/types/database";
import { AppNav, type NavItem } from "@/components/AppNav";
import { SignOutButton } from "@/components/SignOutButton";

const NAV: Record<Profile["role"], NavItem[]> = {
  admin: [
    { href: "/admin", label: "Dashboard", exact: true },
    { href: "/officer", label: "Events" },
    { href: "/admin/students", label: "Students" },
    { href: "/admin/officers", label: "Officers" },
    { href: "/admin/semesters", label: "Semesters" },
    { href: "/admin/audit-log", label: "Audit log" },
  ],
  officer: [{ href: "/officer", label: "Events" }],
  student: [
    { href: "/student", label: "Events", exact: true },
    { href: "/student/history", label: "My attendance" },
  ],
};

const HOME: Record<Profile["role"], string> = {
  admin: "/admin",
  officer: "/officer",
  student: "/student",
};

export function AppHeader({ profile }: { profile: Profile | null }) {
  const items = profile ? NAV[profile.role] : [];

  return (
    <header className="border-b border-slate-200 bg-white print:hidden">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 pt-3">
        <Link href={profile ? HOME[profile.role] : "/"} className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-900 text-xs font-bold text-white">
            C
          </span>
          <span className="text-sm font-semibold text-slate-900">CMAT Attendance</span>
        </Link>
        <div className="flex items-center gap-4">
          {profile && (
            <Link
              href="/account/password"
              className="hidden text-sm text-slate-500 hover:text-slate-900 sm:block"
              title="Change password"
            >
              {profile.full_name}
            </Link>
          )}
          <SignOutButton />
        </div>
      </div>
      <AppNav items={items} />
    </header>
  );
}
