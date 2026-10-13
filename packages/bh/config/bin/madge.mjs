#!/usr/bin/env node
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const madge = (await import('madge')).default;

const configPath = fileURLToPath(new URL('../madge/madge.config.cjs', import.meta.url));
const config = require(configPath);

const targets = process.argv.slice(2);
if (targets.length === 0) {
  console.error('bh-madge: no target path(s) given');
  process.exit(2);
}

const result = await madge(targets, config);
const circular = result.circular();

if (circular.length === 0) {
  const count = Object.keys(result.obj()).length;
  console.log(`✔ No circular dependency found (${count} files)`);
  process.exit(0);
}

console.error(
  `✖ Found ${circular.length} circular dependenc${circular.length === 1 ? 'y' : 'ies'}:`,
);
for (const [i, cycle] of circular.entries()) {
  console.error(`  ${i + 1}) ${cycle.join(' > ')}`);
}
process.exit(1);
