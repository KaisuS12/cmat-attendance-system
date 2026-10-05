import { getCurrentProfile } from "@/lib/session";
import { AppHeader, HAS_BOTTOM_NAV, NAV } from "@/components/AppHeader";
import { BottomNav } from "@/components/AppNav";

// Shared shell for every signed-in section (admin, officer, student, account).
export async function RoleLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  const bottomNav = profile ? HAS_BOTTOM_NAV[profile.role] : false;

  return (
    <div className="flex min-h-full flex-1 flex-col bg-slate-50">
      <AppHeader profile={profile} />
      <main
        className={`mx-auto w-full max-w-4xl flex-1 px-4 py-5 sm:py-8 ${
          bottomNav ? "pb-[calc(5rem+env(safe-area-inset-bottom))] sm:pb-8" : ""
        }`}
      >
        {children}
      </main>
      {profile && bottomNav && <BottomNav items={NAV[profile.role]} />}
    </div>
  );
}
