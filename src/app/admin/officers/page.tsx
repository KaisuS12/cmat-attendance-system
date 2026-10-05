import { createClient } from "@/lib/supabase/server";
import { AddOfficerForm } from "@/components/AddOfficerForm";
import { AccountActions } from "@/components/AccountActions";
import { Badge, EmptyState, PageTitle } from "@/components/ui";
import type { Profile } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function OfficersPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("role", "officer").order("full_name");
  const officers = (data ?? []) as Profile[];

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle title="Officer accounts" subtitle="Officers can create events, scan attendance and export reports." />

      <AddOfficerForm />

      <div className="mt-6 space-y-2">
        {officers.length === 0 ? (
          <EmptyState>No officers yet.</EmptyState>
        ) : (
          officers.map((o) => (
            <div
              key={o.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="min-w-0">
                <p className="font-medium text-slate-900">
                  {o.full_name}{" "}
                  {!o.is_active && <Badge tone="red">Deactivated</Badge>}{" "}
                  {o.must_change_password && o.is_active && <Badge tone="amber">Temporary password</Badge>}
                </p>
                <p className="truncate text-sm text-slate-500">{o.email ?? "—"}</p>
              </div>
              <AccountActions userId={o.id} name={o.full_name} isActive={o.is_active} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
