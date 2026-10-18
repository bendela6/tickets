// Types for changelog.mjs, for TypeScript readers such as @bh/shell/vite.

export interface Line {
  type: string | null;
  scopes: string[];
  breaking: boolean;
  headline: string;
  hash: string | null;
  bullets: string[];
  change: string | null;
}

export interface Entry {
  version: string;
  date: string;
  versions: { name: string; version: string }[] | null;
  lines: Line[];
}

export function stamp(date: Date): string;
export function headerOf(line: Line): string;
export function formatLine(line: Line): string;
export function formatEntry(entry: {
  version: string;
  stampText: string;
  versions?: { name: string; version: string }[] | null;
  lines: Line[];
}): string;
export function parseChangelog(text: string): Entry[];
export function addEntry(
  existing: string | null,
  entryText: string,
  year: number,
): { text: string; moved: Map<string, string> };
export function addToYear(
  existing: string | null,
  entriesText: string,
  year: string | number,
): string;
