import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

// No route may write events/commands/outbox directly — those go through
// runCommand/ctx.emit. Scanned recursively (not just src/routes/): the
// terminal/agent split moved route + orchestration files (agent/routes.ts,
// agent/dispatch.ts, terminal/routes.ts) out of src/routes/ entirely, and
// agent/dispatch.ts explicitly cites this test by name as the reason it goes
// through runCommand — so the guard must actually cover the directory it
// lives in, or the citation is a lie.
const SCAN_DIRS = ['routes', 'agent', 'terminal'];

const collectTsFiles = (dir: string): string[] => {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectTsFiles(full));
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) out.push(full);
  }
  return out;
};

it('no route/agent/terminal file inserts into events/commands/outbox directly', () => {
  const srcDir = join(import.meta.dirname, '..');
  const offenders: string[] = [];
  for (const dir of SCAN_DIRS) {
    for (const file of collectTsFiles(join(srcDir, dir))) {
      const src = readFileSync(file, 'utf8');
      if (/\.insert\(\s*(events|commands|outbox)\b/.test(src)) offenders.push(file);
    }
  }
  expect(offenders).toEqual([]);
});
