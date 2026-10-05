import Image from "next/image";
import Link from "next/link";
import type { Profile } from "@/types/database";
import { AppNav, type NavItem } from "@/components/AppNav";
import { SignOutButton } from "@/components/SignOutButton";

export const NAV: Record<Profile["role"], NavItem[]> = {
  admin: [
    { href: "/admin", label: "Dashboard", exact: true },
    { href: "/officer", label: "Events", exact: true, also: ["/officer/events", "/officer/scan"] },
    { href: "/admin/students", label: "Students" },
    { href: "/admin/officers", label: "Officers" },
    { href: "/admin/semesters", label: "Semesters" },
    { href: "/admin/audit-log", label: "Audit log" },
  ],
  officer: [
    { href: "/officer", label: "Events", icon: "calendar", exact: true, also: ["/officer/events", "/officer/scan"] },
    { href: "/officer/students", label: "Students", icon: "users" },
  ],
  student: [
    { href: "/student", label: "Events", icon: "calendar", exact: true },
    { href: "/student/history", label: "My attendance", short: "Attendance", icon: "list" },
  ],
};

// Roles whose destinations fit a phone tab bar; admins keep the top tabs.
export const HAS_BOTTOM_NAV: Record<Profile["role"], boolean> = {
  admin: false,
  officer: true,
  student: true,
};

const HOME: Record<Profile["role"], string> = {
  admin: "/admin",
  officer: "/officer",
  student: "/student",
};

export function AppHeader({ profile }: { profile: Profile | null }) {
  const items = profile ? NAV[profile.role] : [];
  const bottomNav = profile ? HAS_BOTTOM_NAV[profile.role] : false;

  return (
    <header className="sticky top-0 z-30 border-b-2 border-gold-400 bg-white/95 backdrop-blur print:hidden">
      {/* CMAT gold accent bar */}
      <div className="h-1 bg-gradient-to-r from-gold-500 via-gold-400 to-gold-300" aria-hidden="true" />
      <div className={`mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 ${bottomNav ? "py-2.5 sm:pb-0 sm:pt-3" : "pt-3"}`}>
        <Link href={profile ? HOME[profile.role] : "/"} className="flex min-h-9 items-center gap-2">
          <Image
            src="/brand/cmat-logo.png"
            alt="CMAT logo"
            width={40}
            height={40}
            className="h-10 w-10 object-contain"
            priority
          />
          <span className="text-sm font-bold tracking-tight text-brand-800">CMAT Attendance</span>
        </Link>
        <div className="flex items-center gap-4">
          {profile && (
            <Link
              href="/account/password"
              className="hidden text-sm text-slate-500 hover:text-brand-700 sm:block"
              title="Change password"
            >
              {profile.full_name}
            </Link>
          )}
          <SignOutButton />
        </div>
      </div>
      <AppNav items={items} hideOnPhone={bottomNav} />
    </header>
  );
}
