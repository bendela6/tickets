// apps/api/src/module-independence.test.ts
// The other half of the independence invariant packages/db/src/schema/
// independence.test.ts enforces at the DB layer: `agent` and `terminal` must
// not import from each other, in either direction, and `session-core` (the
// shared base both depend on) must not import from either. A source-scanning
// test, following the precedent in src/command/no-raw-writes.test.ts.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

const collectTsFiles = (dir: string): string[] => {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectTsFiles(full));
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) out.push(full);
  }
  return out;
};

// Matches a relative import/re-export that reaches into a sibling module
// directory, e.g. `from '../terminal/driver'` or `from '../../agent/types'`.
const importsFrom = (src: string, moduleDir: string): boolean =>
  new RegExp(`from ['"](\\.\\./)+${moduleDir}(/|['"])`).test(src);

it('agent does not import from terminal', () => {
  const srcDir = join(import.meta.dirname, 'agent');
  const offenders = collectTsFiles(srcDir).filter((file) =>
    importsFrom(readFileSync(file, 'utf8'), 'terminal'),
  );
  expect(offenders).toEqual([]);
});

it('terminal does not import from agent', () => {
  const srcDir = join(import.meta.dirname, 'terminal');
  const offenders = collectTsFiles(srcDir).filter((file) =>
    importsFrom(readFileSync(file, 'utf8'), 'agent'),
  );
  expect(offenders).toEqual([]);
});

it('session-core does not import from agent or terminal', () => {
  const srcDir = join(import.meta.dirname, 'session-core');
  const offenders = collectTsFiles(srcDir).filter((file) => {
    const src = readFileSync(file, 'utf8');
    return importsFrom(src, 'agent') || importsFrom(src, 'terminal');
  });
  expect(offenders).toEqual([]);
});
