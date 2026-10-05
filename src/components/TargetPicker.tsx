"use client";

import { useEffect, useState } from "react";

export interface Targets {
  programs: string[];
  yearLevels: string[];
}

function Chips({
  label,
  options,
  selected,
  onChange,
  format = (v: string) => v,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  format?: (v: string) => string;
}) {
  const isOn = (v: string) => selected.some((s) => s.toLowerCase() === v.toLowerCase());
  return (
    <div>
      <p className="text-xs font-medium text-slate-500">
        {label} <span className="font-normal text-slate-400">({selected.length === 0 ? "all" : selected.length})</span>
      </p>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {options.map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={isOn(v)}
            onClick={() =>
              onChange(isOn(v) ? selected.filter((s) => s.toLowerCase() !== v.toLowerCase()) : [...selected, v])
            }
            className={`min-h-9 rounded-full border px-3 text-sm font-medium transition ${
              isOn(v) ? "border-brand-700 bg-brand-700 text-white" : "border-brand-200 bg-white text-brand-800"
            }`}
          >
            {format(v)}
          </button>
        ))}
      </div>
    </div>
  );
}

// "Who should attend" — pick programs and/or year levels. Nothing picked in
// a group means everyone in that group.
export function TargetPicker({ value, onChange }: { value: Targets; onChange: (next: Targets) => void }) {
  const [options, setOptions] = useState<Targets | null>(null);

  useEffect(() => {
    let ignore = false;
    fetch("/api/students/facets")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!ignore && data) setOptions({ programs: data.programs, yearLevels: data.yearLevels });
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, []);

  if (!options) return <p className="text-sm text-slate-400">Loading programs…</p>;

  // Keep already-saved targets selectable even if no current student has them.
  const programs = [...new Set([...options.programs, ...value.programs])];
  const yearLevels = [...new Set([...options.yearLevels, ...value.yearLevels])];

  if (programs.length === 0 && yearLevels.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Open to all students. (Import the masterlist with program and year level to target specific groups.)
      </p>
    );
  }

  const everyone = value.programs.length === 0 && value.yearLevels.length === 0;

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        {everyone ? (
          <>Open to <strong>all students</strong>. Pick groups below to limit it.</>
        ) : (
          <>Only students matching the selected groups will see it and be counted.</>
        )}
      </p>
      {programs.length > 0 && (
        <Chips label="Programs" options={programs} selected={value.programs} onChange={(p) => onChange({ ...value, programs: p })} />
      )}
      {yearLevels.length > 0 && (
        <Chips
          label="Year levels"
          options={yearLevels}
          selected={value.yearLevels}
          onChange={(y) => onChange({ ...value, yearLevels: y })}
          format={(v) => (/^\d+$/.test(v) ? `Year ${v}` : v)}
        />
      )}
    </div>
  );
}
