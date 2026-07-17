// apps/api/src/module-independence.test.ts
// The other half of the independence invariant packages/db/src/schema/
// independence.test.ts enforces at the DB layer: `agent` and `terminal` must
// not import from each other, in either direction, and the shared bases both
// depend on — `session-core` (session plumbing) and `workdir` (core.workdirs'
// CRUD + loader) — must not import from either. A source-scanning test,
// following the precedent in src/command/no-raw-writes.test.ts.
//
// Depending on a shared base is ALLOWED and is the point: both subsystems
// import `workdir/`, exactly as both import `session-core/`. What is banned is
// a dependency BETWEEN the two subsystems, in either direction, including the
// invisible kind — `/api/workdirs` used to be registered inside
// registerTerminalRoutes, so unmounting terminal/ broke agent/ with no FK and
// no import for either guard to catch. That is why workdir/ is its own module
// registered from buildApp, and why it is scanned here.
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

it('workdir does not import from agent or terminal', () => {
  const srcDir = join(import.meta.dirname, 'workdir');
  const offenders = collectTsFiles(srcDir).filter((file) => {
    const src = readFileSync(file, 'utf8');
    return importsFrom(src, 'agent') || importsFrom(src, 'terminal');
  });
  expect(offenders).toEqual([]);
});

// The positive half of the invariant: a shared base is there to BE shared.
// If this ever goes red, someone re-homed the workdir CRUD/loader back inside
// a subsystem — the exact coupling the hoist removed.
it('both subsystems depend on the shared workdir module', () => {
  const importers = (moduleDir: string) =>
    collectTsFiles(join(import.meta.dirname, moduleDir)).filter((file) =>
      importsFrom(readFileSync(file, 'utf8'), 'workdir'),
    );
  expect(importers('terminal').length).toBeGreaterThan(0);
  expect(importers('agent').length).toBeGreaterThan(0);
});
