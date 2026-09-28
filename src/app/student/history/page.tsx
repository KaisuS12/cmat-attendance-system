import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AttendanceHistoryPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: records } = await supabase
    .from("attendance_records")
    .select("*, event_days(day_date, event_id, events(title))")
    .eq("student_id", profile?.id ?? "")
    .order("recorded_at", { ascending: false });

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/student" className="text-sm text-slate-500 hover:text-slate-900">
        ← Back
      </Link>
      <h1 className="mt-2 text-xl font-semibold text-slate-900">My Attendance History</h1>
      <p className="text-sm text-slate-500">Full record for the current semester.</p>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-2">Event</th>
              <th className="px-4 py-2">Day</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Recorded at</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {records?.map((r) => {
              // Supabase's generated types make joined rows `any`-ish here;
              // cast narrowly at the point of use rather than modeling the join shape globally.
              const eventDay = r.event_days as unknown as {
                day_date: string;
                events: { title: string };
              };
              return (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-medium text-slate-800">{eventDay?.events?.title}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {eventDay?.day_date && new Date(eventDay.day_date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {r.type === "sign_in" ? "Sign In" : "Sign Out"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {new Date(r.recorded_at).toLocaleString()}
                  </td>
                </tr>
              );
            })}
            {records?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                  No attendance recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
