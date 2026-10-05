import { getCurrentProfile } from "@/lib/session";
import { AttendanceRecordView } from "@/components/AttendanceRecordView";
import { PageTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AttendanceHistoryPage({ searchParams }: PageProps<"/student/history">) {
  const profile = await getCurrentProfile();
  const { semester } = await searchParams;
  if (!profile) return null;

  return (
    <div>
      <div className="print:hidden">
        <PageTitle title="My attendance" subtitle="Your record for clearance. Use Print to save it as a PDF." />
      </div>
      <div className="mt-6">
        <AttendanceRecordView
          student={profile}
          semesterParam={typeof semester === "string" ? semester : undefined}
          basePath="/student/history"
        />
      </div>
    </div>
  );
}
