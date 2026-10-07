// Grouping for printable credential slips: one page-group per
// program + year, so slips can be handed to each class representative
// in a stack.

export interface SlipCredential {
  studentId: string;
  fullName: string;
  tempPassword: string;
  program?: string | null;
  yearLevel?: string | null;
}

export interface SlipGroup {
  label: string;
  slips: SlipCredential[];
}

export function slipGroupLabel(c: Pick<SlipCredential, "program" | "yearLevel">): string {
  return [c.program?.trim(), c.yearLevel?.trim()].filter(Boolean).join(" ") || "Unassigned";
}

export function groupSlips(creds: SlipCredential[]): SlipGroup[] {
  const groups = new Map<string, SlipCredential[]>();
  for (const c of creds) {
    const label = slipGroupLabel(c);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(c);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([label, slips]) => ({
      label,
      slips: [...slips].sort((a, b) => a.fullName.localeCompare(b.fullName)),
    }));
}
