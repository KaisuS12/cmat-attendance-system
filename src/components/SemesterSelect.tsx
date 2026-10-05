"use client";

import { useRouter } from "next/navigation";
import type { Semester } from "@/types/database";

export function SemesterSelect({
  semesters,
  value,
  basePath,
}: {
  semesters: Semester[];
  value: string;
  basePath: string;
}) {
  const router = useRouter();

  return (
    <label className="text-sm text-slate-600">
      <span className="mr-2">Semester</span>
      <select
        value={value}
        onChange={(e) => router.push(`${basePath}?semester=${e.target.value}`)}
        className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
      >
        {semesters.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
            {s.is_active ? " (current)" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
