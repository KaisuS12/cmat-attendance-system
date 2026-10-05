import { getCurrentProfile } from "@/lib/session";
import { AppHeader } from "@/components/AppHeader";

// Shared shell for every signed-in section (admin, officer, student, account).
export async function RoleLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();

  return (
    <div className="flex min-h-full flex-1 flex-col bg-slate-50">
      <AppHeader profile={profile} />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:py-8">{children}</main>
    </div>
  );
}
