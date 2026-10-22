import Link from "next/link";

export interface CourseCount {
  program: string;
  count: number;
  years: { year: string; count: number }[];
}

const ordinal = (y: string) => {
  const n = Number(y);
  if (!Number.isInteger(n)) return y;
  return `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;
};

// One small button per course found on current students, so a new course
// from an imported masterlist shows up on its own. Picking a course adds a
// row of year buttons for it. Plain links: filters live in the URL, so Back
// and refresh keep them.
export function CourseFilter({
  basePath,
  q,
  program,
  year,
  courses,
  total,
  graduated,
  graduatedCount,
}: {
  basePath: string;
  q: string;
  program: string;
  year: string;
  courses: CourseCount[];
  total: number;
  graduated: boolean;
  graduatedCount: number;
}) {
  if (courses.length === 0 && graduatedCount === 0) return null;
  const href = (p: string, y: string, grad = false) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (grad) params.set("status", "graduated");
    if (p && !grad) params.set("program", p);
    if (y && !grad) params.set("year", y);
    return params.size ? `${basePath}?${params}` : basePath;
  };
  const selected = graduated ? undefined : courses.find((c) => c.program.toLowerCase() === program.toLowerCase());
  const allActive = !program && !graduated;

  const pill = (active: boolean, small = false) =>
    `inline-flex shrink-0 items-center gap-1.5 rounded-full border transition ${
      small ? "px-2.5 py-0.5 text-xs" : "px-3 py-1 text-sm"
    } ${
      active
        ? "border-brand-700 bg-brand-700 font-semibold text-white"
        : "border-slate-300 bg-white text-slate-700 hover:border-gold-400 hover:bg-gold-100"
    }`;
  const count = (active: boolean) => `tabular-nums text-xs ${active ? "text-brand-100" : "text-slate-400"}`;

  return (
    <nav aria-label="Filter by course" className="mt-3 space-y-2">
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
        <Link href={href("", "")} scroll={false} aria-current={allActive ? "page" : undefined} className={pill(allActive)}>
          All <span className={count(allActive)}>{total}</span>
        </Link>
        {courses.map((c) => {
          const active = selected?.program === c.program;
          return (
            <Link
              key={c.program}
              href={href(c.program, "")}
              scroll={false}
              aria-current={active ? "page" : undefined}
              className={pill(active)}
            >
              {c.program} <span className={count(active)}>{c.count}</span>
            </Link>
          );
        })}
        {graduatedCount > 0 && (
          <Link
            href={href("", "", true)}
            scroll={false}
            aria-current={graduated ? "page" : undefined}
            className={
              graduated
                ? pill(true)
                : "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-gold-400 bg-gold-100 px-3 py-1 text-sm text-gold-600 transition hover:bg-gold-300"
            }
          >
            🎓 Graduated <span className={count(graduated)}>{graduatedCount}</span>
          </Link>
        )}
      </div>

      {selected && selected.years.length > 1 && (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible" aria-label={`${selected.program} year levels`}>
          <Link href={href(selected.program, "")} scroll={false} aria-current={!year ? "page" : undefined} className={pill(!year, true)}>
            All years
          </Link>
          {selected.years.map((y) => {
            const active = year === y.year;
            return (
              <Link
                key={y.year}
                href={href(selected.program, y.year)}
                scroll={false}
                aria-current={active ? "page" : undefined}
                className={pill(active, true)}
              >
                {ordinal(y.year)} <span className={count(active)}>{y.count}</span>
              </Link>
            );
          })}
        </div>
      )}
    </nav>
  );
}
