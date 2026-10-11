// bh-madge against throwaway projects, run as a package's check:circular runs
// it: from the project's folder, on its src. Run: pnpm --filter @bh/config test
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const bin = fileURLToPath(new URL('../bin/madge.mjs', import.meta.url));
const root = mkdtempSync(join(tmpdir(), 'bh-config-madge-'));
after(() => rmSync(root, { recursive: true, force: true }));

let n = 0;

/** Runs bh-madge on `src` in a project holding `files` (path in src → code). */
function madge(files) {
  n += 1;
  const dir = join(root, `p${n}`);
  for (const [path, code] of Object.entries(files)) {
    mkdirSync(join(dir, 'src', path, '..'), { recursive: true });
    writeFileSync(join(dir, 'src', path), code);
  }
  writeFileSync(join(dir, 'tsconfig.json'), JSON.stringify({ include: ['src'] }));
  const result = spawnSync(process.execPath, [bin, 'src'], { cwd: dir });
  return { code: result.status, out: result.stdout.toString() + result.stderr.toString() };
}

test('passes a project with no cycle', () => {
  const { code, out } = madge({
    'a.ts': "import { b } from './b';\n\nexport const a = b;\n",
    'b.ts': 'export const b = 1;\n',
  });
  assert.equal(code, 0, out);
  assert.match(out, /No circular dependency found \(2 files\)/);
});

test('names each cycle, and counts them in plain English', () => {
  const { code, out } = madge({
    'a.ts': "import { b } from './b';\n\nexport const a = () => b;\n",
    'b.ts': "import { a } from './a';\n\nexport const b = () => a;\n",
    'c.ts': "import { d } from './d';\n\nexport const c = () => d;\n",
    'd.ts': "import { c } from './c';\n\nexport const d = () => c;\n",
  });
  assert.equal(code, 1, out);
  assert.match(out, /Found 2 circular dependencies:/);
  assert.match(out, /1\) a\.ts > b\.ts/);
});

test('says "dependency" for one cycle', () => {
  const { code, out } = madge({
    'a.ts': "import { b } from './b';\n\nexport const a = () => b;\n",
    'b.ts': "import { a } from './a';\n\nexport const b = () => a;\n",
  });
  assert.equal(code, 1, out);
  assert.match(out, /Found 1 circular dependency:/);
});

test('a type-only import is no edge', () => {
  const { code, out } = madge({
    'a.ts': "import type { B } from './b';\n\nexport interface A {\n  b?: B;\n}\n",
    'b.ts': "import type { A } from './a';\n\nexport interface B {\n  a?: A;\n}\n",
  });
  assert.equal(code, 0, out);
});

test('finds a cycle through a file whose name only starts like an excluded folder', () => {
  const { code, out } = madge({
    'distance.ts': "import { route } from './route';\n\nexport const distance = () => route;\n",
    'route.ts': "import { distance } from './distance';\n\nexport const route = () => distance;\n",
  });
  assert.equal(code, 1, out);
  assert.match(out, /distance\.ts > route\.ts/);
});

test('skips a dist folder', () => {
  const { code, out } = madge({
    'a.ts': "import { b } from './dist/b';\n\nexport const a = () => b;\n",
    'dist/b.ts': "import { a } from '../a';\n\nexport const b = () => a;\n",
  });
  assert.equal(code, 0, out);
});

test('asks for a path', () => {
  const result = spawnSync(process.execPath, [bin], { cwd: root });
  assert.equal(result.status, 2);
  assert.match(result.stderr.toString(), /no target path\(s\) given/);
});
