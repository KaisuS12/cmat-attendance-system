"use client";

import Link from "next/link";
import { useState } from "react";
import { parseCsv, toCsv } from "@/lib/csv";
import { IMPORT_CHUNK_SIZE, isValidStudentId, normalizeStudentId, STUDENT_ID_PATTERN } from "@/lib/constants";
import { Alert, btnPrimary, btnSecondary, cardClass, PageTitle } from "@/components/ui";

interface Row {
  line: number;
  studentId: string;
  fullName: string;
  program: string;
  yearLevel: string;
  section: string;
}

interface Invalid {
  line: number;
  studentId: string;
  reason: string;
}

interface ImportResult {
  studentId: string;
  fullName: string;
  status: "created" | "updated" | "exists" | "failed";
  tempPassword?: string;
  error?: string;
}

// Accepts common header spellings from registrar exports.
const HEADER_ALIASES: Record<keyof Omit<Row, "line">, string[]> = {
  studentId: ["student_id", "studentid", "student id", "id number", "id no", "id", "student no", "student number"],
  fullName: ["full_name", "fullname", "full name", "name", "student name"],
  program: ["program", "course"],
  yearLevel: ["year_level", "yearlevel", "year level", "year"],
  section: ["section", "sec"],
};

function download(filename: string, rows: (string | number | null | undefined)[][]) {
  const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function parseMasterlist(text: string): { rows: Row[]; invalid: Invalid[]; error?: string } {
  const table = parseCsv(text);
  if (table.length < 2) return { rows: [], invalid: [], error: "The file has no data rows." };

  const header = table[0].map((h) => h.trim().toLowerCase());
  const col = {} as Record<keyof typeof HEADER_ALIASES, number>;
  for (const [key, aliases] of Object.entries(HEADER_ALIASES) as [keyof typeof HEADER_ALIASES, string[]][]) {
    col[key] = header.findIndex((h) => aliases.includes(h));
  }
  if (col.studentId < 0 || col.fullName < 0) {
    return {
      rows: [],
      invalid: [],
      error: "The first row must be a header with at least “student_id” and “full_name” columns.",
    };
  }

  const rows: Row[] = [];
  const invalid: Invalid[] = [];
  const seen = new Set<string>();
  const cell = (r: string[], i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");

  table.slice(1).forEach((r, idx) => {
    const line = idx + 2;
    const studentId = normalizeStudentId(cell(r, col.studentId));
    const fullName = cell(r, col.fullName).replace(/\s+/g, " ");
    if (!studentId) return invalid.push({ line, studentId, reason: "Missing student ID" });
    if (!isValidStudentId(studentId)) return invalid.push({ line, studentId, reason: "Unrecognized ID format" });
    if (!fullName) return invalid.push({ line, studentId, reason: "Missing name" });
    if (seen.has(studentId.toLowerCase())) return invalid.push({ line, studentId, reason: "Duplicate in file" });
    seen.add(studentId.toLowerCase());
    rows.push({
      line,
      studentId,
      fullName,
      program: cell(r, col.program),
      yearLevel: cell(r, col.yearLevel),
      section: cell(r, col.section),
    });
  });

  return { rows, invalid };
}

export default function ImportStudentsPage() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [invalid, setInvalid] = useState<Invalid[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [permission, setPermission] = useState(false);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [results, setResults] = useState<ImportResult[] | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    setResults(null);
    setRunError(null);
    if (!file) return;
    setFileName(file.name);
    const parsed = parseMasterlist(await file.text());
    setRows(parsed.rows);
    setInvalid(parsed.invalid);
    setParseError(parsed.error ?? null);
  }

  async function runImport() {
    setRunning(true);
    setDone(0);
    setRunError(null);
    const all: ImportResult[] = [];

    for (let i = 0; i < rows.length; i += IMPORT_CHUNK_SIZE) {
      const chunk = rows.slice(i, i + IMPORT_CHUNK_SIZE);
      try {
        const res = await fetch("/api/students/bulk-import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            students: chunk.map(({ studentId, fullName, program, yearLevel, section }) => ({
              studentId,
              fullName,
              program,
              yearLevel,
              section,
            })),
            updateExisting,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
        all.push(...data.results);
      } catch (err) {
        // Keep going: mark this chunk failed so it can be retried by re-importing
        // (already-created students are skipped as "exists").
        const message = err instanceof Error ? err.message : "Network error";
        all.push(...chunk.map((r) => ({ studentId: r.studentId, fullName: r.fullName, status: "failed" as const, error: message })));
        setRunError("Some rows failed. Download the report, fix the problem, and import the same file again — existing students are skipped.");
      }
      setDone(Math.min(i + IMPORT_CHUNK_SIZE, rows.length));
    }

    setResults(all);
    setRunning(false);
  }

  const created = results?.filter((r) => r.status === "created") ?? [];
  const existing = results?.filter((r) => r.status === "exists") ?? [];
  const updated = results?.filter((r) => r.status === "updated") ?? [];
  const failed = results?.filter((r) => r.status === "failed") ?? [];

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/admin/students" className="text-sm text-slate-500 hover:text-slate-900">
        ← Students
      </Link>
      <div className="mt-2">
        <PageTitle title="Import masterlist" subtitle="Create student accounts from a CSV file." />
      </div>

      <div className={`${cardClass} mt-6 space-y-3 text-sm text-slate-600`}>
        <p>
          Save the masterlist as <strong>CSV</strong> (in Excel: File → Save As → CSV UTF-8). The first row must be a
          header. Required columns: <code>student_id</code>, <code>full_name</code>. Optional: <code>program</code>,{" "}
          <code>year_level</code>, <code>section</code>.
        </p>
        <p>
          Student IDs must match <code>{STUDENT_ID_PATTERN.source}</code>. Students already in the system are skipped,
          so it&apos;s safe to import an updated list.
        </p>
        <button
          onClick={() =>
            download("masterlist-template.csv", [
              ["student_id", "full_name", "program", "year_level", "section"],
              ["21-00123", "Juan Dela Cruz", "BSIT", "3", "A"],
            ])
          }
          className="text-sm font-medium text-slate-700 underline"
        >
          Download a template
        </button>
      </div>

      {!results && (
        <div className={`${cardClass} mt-4 space-y-4`}>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">CSV file</span>
            <input
              type="file"
              accept=".csv,text/csv"
              disabled={running}
              onChange={(e) => handleFile(e.target.files?.[0])}
              className="mt-1 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
            />
          </label>

          {parseError && <Alert kind="error">{parseError}</Alert>}

          {fileName && !parseError && (
            <>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="rounded-lg bg-emerald-50 p-3">
                  <p className="text-2xl font-semibold text-emerald-700">{rows.length}</p>
                  <p className="text-xs uppercase tracking-wide text-emerald-700">Ready to import</p>
                </div>
                <div className={`rounded-lg p-3 ${invalid.length ? "bg-amber-50" : "bg-slate-50"}`}>
                  <p className={`text-2xl font-semibold ${invalid.length ? "text-amber-700" : "text-slate-400"}`}>
                    {invalid.length}
                  </p>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Will be skipped</p>
                </div>
              </div>

              {invalid.length > 0 && (
                <details className="rounded-lg border border-amber-200 p-3 text-sm">
                  <summary className="cursor-pointer font-medium text-amber-800">Rows with problems</summary>
                  <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-slate-600">
                    {invalid.map((r) => (
                      <li key={r.line}>
                        Line {r.line}: {r.studentId || "(blank)"} — {r.reason}
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              {rows.length > 0 && (
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
                      <tr>
                        <th className="px-3 py-2">ID</th>
                        <th className="px-3 py-2">Name</th>
                        <th className="px-3 py-2">Program</th>
                        <th className="px-3 py-2">Yr/Sec</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rows.slice(0, 5).map((r) => (
                        <tr key={r.line}>
                          <td className="px-3 py-1.5">{r.studentId}</td>
                          <td className="px-3 py-1.5">{r.fullName}</td>
                          <td className="px-3 py-1.5">{r.program}</td>
                          <td className="px-3 py-1.5">{[r.yearLevel, r.section].filter(Boolean).join("-")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {rows.length > 5 && (
                    <p className="border-t border-slate-100 px-3 py-1.5 text-xs text-slate-400">
                      …and {rows.length - 5} more
                    </p>
                  )}
                </div>
              )}

              <label className="flex items-start gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={updateExisting}
                  onChange={(e) => setUpdateExisting(e.target.checked)}
                  className="mt-0.5 h-4 w-4"
                />
                Update name, program, year and section for students already in the system (their passwords
                aren&apos;t changed).
              </label>

              <label className="flex items-start gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={permission}
                  onChange={(e) => setPermission(e.target.checked)}
                  className="mt-0.5"
                />
                Written permission to use this masterlist has been secured from the department (Data Privacy Act).
              </label>

              {running && (
                <div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full bg-slate-900 transition-all"
                      style={{ width: `${rows.length ? (done / rows.length) * 100 : 0}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {done} of {rows.length} — keep this tab open.
                  </p>
                </div>
              )}

              <button
                onClick={runImport}
                disabled={!permission || running || rows.length === 0}
                className={`${btnPrimary} w-full`}
              >
                {running ? "Importing..." : `Import ${rows.length} students`}
              </button>
            </>
          )}
        </div>
      )}

      {results && (
        <div className={`${cardClass} mt-4 space-y-4`}>
          <h2 className="font-semibold text-slate-900">Import finished</h2>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg bg-emerald-50 p-3">
              <p className="text-2xl font-semibold text-emerald-700">{created.length}</p>
              <p className="text-xs uppercase tracking-wide text-emerald-700">Created</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-2xl font-semibold text-slate-600">{updated.length + existing.length}</p>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                {updated.length > 0 ? `Existing (${updated.length} updated)` : "Already existed"}
              </p>
            </div>
            <div className={`rounded-lg p-3 ${failed.length ? "bg-red-50" : "bg-slate-50"}`}>
              <p className={`text-2xl font-semibold ${failed.length ? "text-red-700" : "text-slate-400"}`}>
                {failed.length}
              </p>
              <p className="text-xs uppercase tracking-wide text-slate-500">Failed</p>
            </div>
          </div>

          {runError && <Alert kind="error">{runError}</Alert>}

          {created.length > 0 && (
            <Alert kind="info">
              Download the credentials now — temporary passwords are <strong>not stored</strong> and can&apos;t be
              shown again (you can still reset a student&apos;s password later). Students must set their own password
              on first login. Keep this file private and delete it after distributing.
            </Alert>
          )}

          <div className="flex flex-wrap gap-2">
            {created.length > 0 && (
              <button
                onClick={() =>
                  download("student-credentials.csv", [
                    ["student_id", "full_name", "temporary_password"],
                    ...created.map((r) => [r.studentId, r.fullName, r.tempPassword]),
                  ])
                }
                className={btnPrimary}
              >
                Download credentials ({created.length})
              </button>
            )}
            <button
              onClick={() =>
                download("import-report.csv", [
                  ["student_id", "full_name", "status", "error"],
                  ...results.map((r) => [r.studentId, r.fullName, r.status, r.error ?? ""]),
                  ...invalid.map((r) => [r.studentId, "", "skipped", `Line ${r.line}: ${r.reason}`]),
                ])
              }
              className={btnSecondary}
            >
              Download full report
            </button>
            <button
              onClick={() => {
                setResults(null);
                setRows([]);
                setInvalid([]);
                setFileName(null);
                setPermission(false);
              }}
              className={btnSecondary}
            >
              Import another file
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
