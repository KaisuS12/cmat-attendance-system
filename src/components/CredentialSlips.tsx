"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { groupSlips, type SlipCredential } from "@/lib/slips";
import { btnSecondary } from "@/components/ui";

// Printable cut-out cards with each student's login details, grouped and
// page-broken by section. The sheet is rendered into <body> only while
// printing, and the print stylesheet hides everything else (globals.css).
export function PrintSlipsButton({
  credentials,
  label = "Print slips",
  className = btnSecondary,
}: {
  credentials: SlipCredential[];
  label?: string;
  className?: string;
}) {
  const [printing, setPrinting] = useState(false);

  function print() {
    setPrinting(true);
    document.documentElement.classList.add("printing-slips");
    // Let the portal render before opening the print dialog.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const done = () => {
          document.documentElement.classList.remove("printing-slips");
          setPrinting(false);
          window.removeEventListener("afterprint", done);
        };
        window.addEventListener("afterprint", done);
        window.print();
      })
    );
  }

  return (
    <>
      <button type="button" onClick={print} disabled={credentials.length === 0} className={className}>
        {label}
      </button>
      {printing && createPortal(<SlipSheet credentials={credentials} />, document.body)}
    </>
  );
}

function SlipSheet({ credentials }: { credentials: SlipCredential[] }) {
  const loginUrl = `${window.location.origin}/login`;
  const groups = groupSlips(credentials);

  return (
    <div className="slip-sheet bg-white text-slate-900">
      {groups.map((group) => (
        <section key={group.label} className="slip-group">
          <h2 className="mb-2 text-sm font-semibold">
            {group.label} · {group.slips.length} student{group.slips.length === 1 ? "" : "s"}
          </h2>
          <div className="grid grid-cols-2 gap-0">
            {group.slips.map((s) => (
              <div key={s.studentId} className="slip-card border border-dashed border-slate-400 p-3 text-xs">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  CMAT Council Attendance
                </p>
                <p className="mt-1 text-sm font-semibold">{s.fullName}</p>
                <p className="mt-1">
                  Student ID: <span className="font-mono font-semibold">{s.studentId}</span>
                </p>
                <p>
                  Temporary password: <span className="font-mono text-sm font-semibold">{s.tempPassword}</span>
                </p>
                <p className="mt-1 text-[10px] text-slate-600">
                  Log in at {loginUrl} and set your own password. Keep this slip private.
                </p>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
