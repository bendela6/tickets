import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

// No route may write events/commands/outbox directly — those go through runCommand/ctx.emit.
it('no route file inserts into events/commands/outbox directly', () => {
  const routesDir = join(import.meta.dirname, '..', 'routes');
  const offenders: string[] = [];
  for (const file of readdirSync(routesDir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))) {
    const src = readFileSync(join(routesDir, file), 'utf8');
    if (/\.insert\(\s*(events|commands|outbox)\b/.test(src)) offenders.push(file);
  }
  expect(offenders).toEqual([]);
});
