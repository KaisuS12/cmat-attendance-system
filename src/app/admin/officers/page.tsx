import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/session";
import { AddOfficerForm } from "@/components/AddOfficerForm";
import { AccountActions } from "@/components/AccountActions";
import { RoleButton } from "@/components/RoleButton";
import { RemoveStaffButton } from "@/components/RemoveStaffButton";
import { Badge, EmptyState, PageTitle } from "@/components/ui";
import type { Profile } from "@/types/database";

export const dynamic = "force-dynamic";

type ActivityCounts = { scans: number; manual: number };

function StaffRow({ person, me, activity }: { person: Profile; me: string | undefined; activity: ActivityCounts }) {
  const isMe = person.id === me;
  const isAdmin = person.role === "admin";
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 border-l-4 border-l-gold-400 bg-white p-4">
      <div className="min-w-0">
        <p className="font-medium text-slate-900">
          {person.full_name}{" "}
          {isMe && <Badge tone="blue">You</Badge>}{" "}
          {!person.is_active && <Badge tone="red">Deactivated</Badge>}{" "}
          {person.must_change_password && person.is_active && <Badge tone="amber">Temporary password</Badge>}
        </p>
        <p className="truncate text-sm text-slate-500">{person.email ?? "—"}</p>
        <Link
          href={`/admin/officers/${person.id}`}
          className="mt-1.5 inline-flex min-h-9 items-center text-sm font-medium text-brand-700 hover:underline"
        >
          Activity: {activity.scans} {activity.scans === 1 ? "scan" : "scans"} · {activity.manual} manual →
        </Link>
      </div>
      {!isMe && (
        <div className="flex flex-col items-end gap-2">
          <RoleButton userId={person.id} name={person.full_name} role={isAdmin ? "admin" : "officer"} />
          {/* Admins can't be reset or deactivated from here (switch them to
              officer first), so one admin can't quietly lock out another. */}
          {!isAdmin && <AccountActions userId={person.id} name={person.full_name} isActive={person.is_active} />}
          {!isAdmin && <RemoveStaffButton userId={person.id} name={person.full_name} />}
        </div>
      )}
    </div>
  );
}

export default async function StaffPage() {
  const supabase = await createClient();
  const [me, { data }] = await Promise.all([
    getCurrentProfile(),
    supabase.from("profiles").select("*").in("role", ["admin", "officer"]).order("full_name"),
  ]);
  const staff = (data ?? []) as Profile[];
  const admins = staff.filter((p) => p.role === "admin");
  const officers = staff.filter((p) => p.role === "officer" && p.is_active);
  // Deactivated or removed officers are kept (their names are on past
  // records) but tucked away below.
  const former = staff.filter((p) => p.role === "officer" && !p.is_active);

  // Scans and manual entries per person, for the links to their activity log.
  const countRecords = async (id: string, method: "qr" | "manual") => {
    const { count } = await supabase
      .from("attendance_records")
      .select("id", { count: "exact", head: true })
      .eq("scanned_by", id)
      .eq("method", method);
    return count ?? 0;
  };
  const activity = new Map(
    await Promise.all(
      staff.map(async (p): Promise<[string, ActivityCounts]> => {
        const [scans, manual] = await Promise.all([countRecords(p.id, "qr"), countRecords(p.id, "manual")]);
        return [p.id, { scans, manual }];
      })
    )
  );
  const row = (p: Profile) => (
    <StaffRow key={p.id} person={p} me={me?.id} activity={activity.get(p.id) ?? { scans: 0, manual: 0 }} />
  );

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle
        title="Officers & admins"
        subtitle="Officers run events and scanning. Admins also manage accounts, semesters and imports."
      />

      <AddOfficerForm />

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-gold-600">Admins ({admins.length})</h2>
      <div className="mt-2 space-y-2">
        {admins.map(row)}
      </div>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-gold-600">Officers ({officers.length})</h2>
      <div className="mt-2 space-y-2">
        {officers.length === 0 ? (
          <EmptyState>No officers yet.</EmptyState>
        ) : (
          officers.map(row)
        )}
      </div>

      {former.length > 0 && (
        <details className="mt-8">
          <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wide text-slate-500">
            Former officers ({former.length})
          </summary>
          <p className="mt-1 text-xs text-slate-500">
            Can&apos;t log in. Kept because their names are on events or scans they handled. Reactivate to bring one
            back.
          </p>
          <div className="mt-2 space-y-2">
            {former.map(row)}
          </div>
        </details>
      )}
    </div>
  );
}
