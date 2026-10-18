#!/usr/bin/env node
// bh-hooks: a repo's `prepare` script, so `pnpm install` sets up its git hooks.
// Writes the commit-msg hook that runs bh-commit-check. Does nothing outside a
// git repo (a Docker build), and leaves a hook it did not write alone.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const MARK = '# written by bh-hooks';
const HOOK = `#!/bin/sh
${MARK} (pnpm install): checks the message's format.
[ -x node_modules/.bin/bh-commit-check ] || exit 0
exec node_modules/.bin/bh-commit-check "$1"
`;

const found = spawnSync('git', ['rev-parse', '--git-path', 'hooks'], { encoding: 'utf8' });
if (found.error || found.status !== 0) {
  process.exit(0);
}
const dir = resolve(found.stdout.trim());
const file = join(dir, 'commit-msg');
if (existsSync(file) && !readFileSync(file, 'utf8').includes(MARK)) {
  console.log(`bh-hooks: ${file} is not bh's; left as it is`);
  process.exit(0);
}
mkdirSync(dir, { recursive: true });
writeFileSync(file, HOOK, { mode: 0o755 });
