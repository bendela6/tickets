#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const pkgJsonPath = require.resolve('eslint/package.json');
const pkg = require(pkgJsonPath);
const binField = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin.eslint;
const binPath = join(dirname(pkgJsonPath), binField);

const result = spawnSync(process.execPath, [binPath, ...process.argv.slice(2)], {
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
