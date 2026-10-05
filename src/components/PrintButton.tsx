"use client";

import { btnSecondary } from "@/components/ui";

export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <button onClick={() => window.print()} className={`${btnSecondary} print:hidden`}>
      {label}
    </button>
  );
}
