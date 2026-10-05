import { createClient } from "@/lib/supabase/server";
import { AddSemesterForm } from "@/components/AddSemesterForm";
import { SetActiveSemesterButton } from "@/components/SetActiveSemesterButton";
import { Badge, btnSecondary, EmptyState, PageTitle } from "@/components/ui";
import { formatDayDate } from "@/lib/datetime";
import type { Semester } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function SemestersPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("semesters").select("*").order("start_date", { ascending: false });
  const semesters = (data ?? []) as Semester[];

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle
        title="Semesters"
        subtitle="New events are added to the active semester. Export a clearance sheet per semester."
      />

      <AddSemesterForm isFirst={semesters.length === 0} />

      <div className="mt-6 space-y-2">
        {semesters.length === 0 ? (
          <EmptyState>No semesters yet.</EmptyState>
        ) : (
          semesters.map((s) => (
            <div
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4"
            >
              <div>
                <p className="font-medium text-slate-900">
                  {s.name} {s.is_active && <Badge tone="green">Active</Badge>}
                </p>
                <p className="text-sm text-slate-500">
                  {formatDayDate(s.start_date, "numeric")} – {formatDayDate(s.end_date, "numeric")}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {!s.is_active && <SetActiveSemesterButton semesterId={s.id} />}
                <a href={`/api/semesters/${s.id}/export`} className={`${btnSecondary} px-3 py-1.5 text-xs`}>
                  Clearance CSV
                </a>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
