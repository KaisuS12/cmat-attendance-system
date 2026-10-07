import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/session";
import { AddOfficerForm } from "@/components/AddOfficerForm";
import { AccountActions } from "@/components/AccountActions";
import { RoleButton } from "@/components/RoleButton";
import { Badge, EmptyState, PageTitle } from "@/components/ui";
import type { Profile } from "@/types/database";

export const dynamic = "force-dynamic";

function StaffRow({ person, me }: { person: Profile; me: string | undefined }) {
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
      </div>
      {!isMe && (
        <div className="flex flex-col items-end gap-2">
          <RoleButton userId={person.id} name={person.full_name} role={isAdmin ? "admin" : "officer"} />
          {/* Admins can't be reset or deactivated from here (switch them to
              officer first), so one admin can't quietly lock out another. */}
          {!isAdmin && <AccountActions userId={person.id} name={person.full_name} isActive={person.is_active} />}
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
  const officers = staff.filter((p) => p.role === "officer");

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle
        title="Officers & admins"
        subtitle="Officers run events and scanning. Admins also manage accounts, semesters and imports."
      />

      <AddOfficerForm />

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-gold-600">Admins ({admins.length})</h2>
      <div className="mt-2 space-y-2">
        {admins.map((p) => (
          <StaffRow key={p.id} person={p} me={me?.id} />
        ))}
      </div>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-gold-600">Officers ({officers.length})</h2>
      <div className="mt-2 space-y-2">
        {officers.length === 0 ? (
          <EmptyState>No officers yet.</EmptyState>
        ) : (
          officers.map((p) => <StaffRow key={p.id} person={p} me={me?.id} />)
        )}
      </div>
    </div>
  );
}
