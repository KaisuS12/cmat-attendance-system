"use client";

import Link from "next/link";
import { useState } from "react";
import { parseCsv, toCsv } from "@/lib/csv";
import { generatedIdPrefix, IMPORT_CHUNK_SIZE } from "@/lib/constants";
import { parseMasterlistTable, type MasterlistIssue, type MasterlistRow } from "@/lib/masterlist";
import { PrintSlipsButton } from "@/components/CredentialSlips";
import { Alert, btnPrimary, btnSecondary, cardClass, PageTitle } from "@/components/ui";

interface ImportResult {
  studentId: string;
  fullName: string;
  status: "created" | "updated" | "exists" | "failed";
  tempPassword?: string;
  error?: string;
  program?: string;
  yearLevel?: string;
}

// Excel files are read in the browser; SheetJS is only downloaded when one
// is picked. Every cell comes back as the text Excel shows.
async function readTable(file: File): Promise<string[][]> {
  if (/\.csv$/i.test(file.name) || file.type === "text/csv") return parseCsv(await file.text());
  const XLSX = await import("xlsx");
  const book = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const sheet = book.Sheets[book.SheetNames[0]];
  return XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: "", blankrows: true });
}

function download(filename: string, rows: (string | number | null | undefined)[][]) {
  const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ImportStudentsPage() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<MasterlistRow[]>([]);
  const [invalid, setInvalid] = useState<MasterlistIssue[]>([]);
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
    let parsed;
    try {
      parsed = parseMasterlistTable(await readTable(file));
    } catch {
      parsed = { rows: [], skipped: [], hasIds: false, error: "Couldn't read this file. Save it as .xlsx or .csv and try again." };
    }
    if (!parsed.error && parsed.rows.length === 0) parsed.error = "No students found below the header row.";
    setRows(parsed.rows);
    setInvalid(parsed.skipped);
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
            students: chunk.map(({ studentId, fullName, program, yearLevel }) => ({
              studentId,
              fullName,
              program,
              yearLevel,
            })),
            updateExisting,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !Array.isArray(data.results)) {
          throw new Error(
            res.status === 401 || res.status === 403
              ? "You were logged out. Log in again as an admin, then import the same file."
              : (data.error ?? `The server didn't answer properly (error ${res.status}).`)
          );
        }
        // Results come back in row order; keep program/year for the slips.
        all.push(
          ...(data.results as ImportResult[]).map((r, j) => ({
            ...r,
            program: chunk[j]?.program,
            yearLevel: chunk[j]?.yearLevel,
          }))
        );
      } catch (err) {
        // Keep going: mark this chunk failed so it can be retried by re-importing
        // (already-created students are skipped as "exists").
        const message =
          err instanceof TypeError ? "Lost connection to the server." : err instanceof Error ? err.message : "Network error";
        all.push(...chunk.map((r) => ({ studentId: r.studentId, fullName: r.fullName, status: "failed" as const, error: message })));
        setRunError(
          `${message} Some of these students may have been created anyway — import the same file again: anyone already created shows as “already existed”, and nobody is duplicated.`
        );
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
        <PageTitle title="Import masterlist" subtitle="Create student accounts from the Excel masterlist." />
      </div>

      <div className={`${cardClass} mt-6 space-y-3 text-sm text-slate-600`}>
        <p>
          Upload the masterlist as it is — <strong>Excel (.xlsx / .xls)</strong> or CSV. Title rows at the top and
          &ldquo;Male&rdquo; / &ldquo;Female&rdquo; rows are skipped automatically. Only two columns are needed:{" "}
          <strong>Student Name</strong> and <strong>Course</strong> (e.g. &ldquo;BSTM 1&rdquo; becomes program BSTM, year
          1).
        </p>
        <p>
          No student ID column? Each student gets one automatically (<code>{generatedIdPrefix()}0001</code>,{" "}
          <code>{generatedIdPrefix()}0002</code>, …) — it&apos;s printed on their slip and is what they log in with.
          Students already in the system are skipped (matched by name, program and year), so it&apos;s safe to upload
          the same or an updated list again.
        </p>
        <button
          onClick={() =>
            download("masterlist-template.csv", [
              ["Student Name", "Course"],
              ["DELA CRUZ, JUAN SANTOS", "BSTM 1"],
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
            <span className="text-sm font-medium text-slate-700">Masterlist file</span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              disabled={running}
              onChange={(e) => handleFile(e.target.files?.[0])}
              className="mt-1 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-brand-700 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
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
                        Row {r.line}: {r.text} — {r.reason}
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              {rows.length > 0 && (
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="bg-gold-100 text-left text-xs uppercase tracking-wide text-gold-600">
                      <tr>
                        <th className="px-3 py-2">ID</th>
                        <th className="px-3 py-2">Name</th>
                        <th className="px-3 py-2">Program</th>
                        <th className="px-3 py-2">Year</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rows.slice(0, 5).map((r) => (
                        <tr key={r.line}>
                          <td className="px-3 py-1.5">
                            {r.studentId || (
                              <span className="rounded bg-gold-100 px-1.5 py-0.5 text-xs font-medium text-gold-600">Auto</span>
                            )}
                          </td>
                          <td className="px-3 py-1.5">{r.fullName}</td>
                          <td className="px-3 py-1.5">{r.program}</td>
                          <td className="px-3 py-1.5">{r.yearLevel}</td>
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
                Update name, program and year for students already in the system (their passwords
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
                      className="h-full bg-brand-600 transition-all"
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
              Download or print the credentials now — temporary passwords are <strong>not stored</strong> and can&apos;t be
              shown again (you can still reset a student&apos;s password later). Students must set their own password
              on first login. Keep this file private and delete it after distributing.
            </Alert>
          )}

          <div className="flex flex-wrap gap-2">
            {created.length > 0 && (
              <button
                onClick={() =>
                  download("student-credentials.csv", [
                    ["student_id", "full_name", "program", "year_level", "temporary_password"],
                    ...created.map((r) => [r.studentId, r.fullName, r.program, r.yearLevel, r.tempPassword]),
                  ])
                }
                className={btnPrimary}
              >
                Download credentials ({created.length})
              </button>
            )}
            {created.length > 0 && (
              <PrintSlipsButton
                label={`Print slips (${created.length})`}
                credentials={created.map((r) => ({
                  studentId: r.studentId,
                  fullName: r.fullName,
                  tempPassword: r.tempPassword ?? "",
                  program: r.program,
                  yearLevel: r.yearLevel,
                }))}
              />
            )}
            <button
              onClick={() =>
                download("import-report.csv", [
                  ["student_id", "full_name", "status", "error"],
                  ...results.map((r) => [r.studentId, r.fullName, r.status, r.error ?? ""]),
                  ...invalid.map((r) => ["", r.text, "skipped", `Row ${r.line}: ${r.reason}`]),
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
