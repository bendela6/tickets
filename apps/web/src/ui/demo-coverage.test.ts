// @ts-ignore
import { readdirSync } from 'node:fs';
// @ts-ignore
import { dirname, join } from 'node:path';
// @ts-ignore
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Non-visual helper modules exempted from the sibling-demo rule. Additions
// to this list are the documented exception path — justify in the PR.
const ALLOWLIST = new Set([
  'combobox-list', // internal list engine, exercised via combobox/multi-combobox demos
  'use-directory-tree', // hook
  'directory-tree', // fetch-coupled; demo lands with its P3 move
  'field-error', // covered by field-label.demo.tsx
]);

describe('demo coverage', () => {
  it('every ui component module has a sibling .demo.tsx (or an allowlist entry)', () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const files = readdirSync(dir);
    const components = files
      .filter((f: string) => /\.(ts|tsx)$/.test(f))
      .filter((f: string) => !/\.(test|demo)\.tsx?$/.test(f))
      .map((f: string) => f.replace(/\.tsx?$/, ''))
      .filter((name: string) => !['cn', 'variants'].includes(name)); // deleted in P1; guard against strays
    const missing = components.filter(
      (name: string) => !ALLOWLIST.has(name) && !files.includes(`${name}.demo.tsx`),
    );
    expect(missing).toEqual([]);
  });
});
