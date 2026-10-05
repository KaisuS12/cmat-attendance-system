import { StudentDirectory, parseDirectoryParams } from "@/components/StudentDirectory";
import { PageTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

// Officers look up students here to reset a forgotten password (e.g. at the
// event entrance) and hand them a printed slip.
export default async function OfficerStudentsPage({ searchParams }: PageProps<"/officer/students">) {
  const { q, page } = parseDirectoryParams(await searchParams);

  return (
    <div>
      <PageTitle title="Students" subtitle="Reset a student's forgotten password." />
      <div className="mt-4">
        <StudentDirectory basePath="/officer/students" q={q} page={page} mode="officer" />
      </div>
    </div>
  );
}
