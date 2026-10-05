import Link from "next/link";
import { AddStudentForm } from "@/components/AddStudentForm";
import { StudentDirectory, parseDirectoryParams } from "@/components/StudentDirectory";
import { btnPrimary, PageTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function StudentsPage({ searchParams }: PageProps<"/admin/students">) {
  const { q, page } = parseDirectoryParams(await searchParams);

  return (
    <div>
      <PageTitle
        title="Students"
        actions={
          <Link href="/admin/students/import" className={btnPrimary}>
            Import masterlist
          </Link>
        }
      />
      <div className="mt-4">
        <AddStudentForm />
      </div>
      <div className="mt-4">
        <StudentDirectory basePath="/admin/students" q={q} page={page} mode="admin" />
      </div>
    </div>
  );
}
