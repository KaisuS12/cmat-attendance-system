import Link from "next/link";
import { pageItems } from "@/lib/pagination";

// "Showing 11–20 of 245" plus Prev, page numbers and Next. Plain links, so
// the current filter stays in the address and Back works.
export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  href,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  href: (page: number) => string;
}) {
  if (totalPages <= 1) return null;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  const box = "inline-flex h-10 min-w-10 items-center justify-center rounded-lg border px-3 text-sm transition";
  const idle = `${box} border-slate-300 bg-white text-slate-700 hover:border-gold-400 hover:bg-gold-100`;
  const off = `${box} cursor-not-allowed border-slate-200 bg-white text-slate-300`;

  return (
    <nav aria-label="Pages" className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm text-slate-500">
        Showing <span className="tabular-nums">{first}–{last}</span> of <span className="tabular-nums">{total}</span>
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        {page > 1 ? (
          <Link href={href(page - 1)} scroll={false} className={idle} aria-label="Previous page">
            ← Prev
          </Link>
        ) : (
          <span className={off} aria-hidden="true">
            ← Prev
          </span>
        )}

        {/* Narrow phones: just "3 / 25"; wider screens: the page numbers. */}
        <span className="px-2 text-sm tabular-nums text-slate-600 sm:hidden">
          {page} / {totalPages}
        </span>
        <span className="hidden items-center gap-1.5 sm:flex">
          {pageItems(page, totalPages).map((p, i) =>
            p === "gap" ? (
              <span key={`gap-${i}`} className="px-1 text-slate-400" aria-hidden="true">
                …
              </span>
            ) : p === page ? (
              <span
                key={p}
                aria-current="page"
                className={`${box} border-brand-700 bg-brand-700 font-semibold tabular-nums text-white`}
              >
                {p}
              </span>
            ) : (
              <Link key={p} href={href(p)} scroll={false} className={`${idle} tabular-nums`} aria-label={`Page ${p}`}>
                {p}
              </Link>
            )
          )}
        </span>

        {page < totalPages ? (
          <Link href={href(page + 1)} scroll={false} className={idle} aria-label="Next page">
            Next →
          </Link>
        ) : (
          <span className={off} aria-hidden="true">
            Next →
          </span>
        )}
      </div>
    </nav>
  );
}
