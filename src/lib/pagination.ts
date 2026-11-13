// Which page numbers to show: the first, the last, and up to two on each
// side of the current one, with "gap" where pages are skipped.
export function pageItems(page: number, totalPages: number): (number | "gap")[] {
  const items: (number | "gap")[] = [];
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || Math.abs(p - page) <= 2) items.push(p);
    else if (items.at(-1) !== "gap") items.push("gap");
  }
  return items;
}
