// The ESLint presets and the bh/* rule, run as an app runs them: each preset
// over files written to a throwaway project with its own tsconfig, which the
// presets' type-aware rules need. Run: pnpm --filter @bh/config test
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it, test } from 'node:test';
import { ESLint, RuleTester } from 'eslint';
import base from '../eslint/base.js';
import node from '../eslint/node.js';
import react from '../eslint/react.js';
import multilineArrowNeedsBody from '../eslint/rules/multiline-arrow-needs-body.js';

const root = mkdtempSync(join(tmpdir(), 'bh-config-eslint-'));
after(() => rmSync(root, { recursive: true, force: true }));

let n = 0;

/** Lints `files` (path → code) with `preset`, in a project of their own. */
async function lint(preset, files) {
  n += 1;
  const dir = join(root, `p${n}`);
  mkdirSync(join(dir, 'src'), { recursive: true });
  writeFileSync(
    join(dir, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        strict: true,
        target: 'ES2022',
        module: 'ES2022',
        moduleResolution: 'bundler',
        jsx: 'react-jsx',
        noEmit: true,
        types: [],
      },
      include: ['src'],
    }),
  );
  for (const [path, code] of Object.entries(files)) {
    writeFileSync(join(dir, path), code);
  }
  const eslint = new ESLint({ cwd: dir, overrideConfigFile: true, overrideConfig: preset });
  const results = await eslint.lintFiles(Object.keys(files));
  return Object.fromEntries(
    results.map((result) => {
      const path = result.filePath.slice(dir.length + 1).replaceAll('\\', '/');
      return [path, result.messages.map((message) => message.ruleId)];
    }),
  );
}

const PROCESS = 'declare const process: { env: Record<string, string | undefined> };\n';

test('the react preset lints a component', async () => {
  const found = await lint(react, {
    'src/list.tsx':
      'export function List({ names }: { names: string[] }) {\n' +
      '  return <ul>{names.map((name) => <li>{name}</li>)}</ul>;\n' +
      '}\n',
  });
  assert.deepEqual(found['src/list.tsx'], ['react/jsx-key']);
});

test('the node preset keeps the base ban on .js relative imports', async () => {
  const found = await lint(node, {
    'src/b.ts': 'export const b = 1;\n',
    'src/a.ts': "import { b } from './b.js';\n\nexport const a = b;\n",
    'src/environment.ts':
      PROCESS + "import { b } from './b.js';\n\nexport const port = process.env.PORT ?? b;\n",
  });
  assert.deepEqual(found['src/a.ts'], ['no-restricted-syntax']);
  assert.deepEqual(found['src/environment.ts'], ['no-restricted-syntax']);
});

test('the node preset reports process.env once, outside environment.ts', async () => {
  const found = await lint(node, {
    'src/port.ts': PROCESS + 'export const port = process.env.PORT;\n',
    'src/environment.ts': PROCESS + 'export const port = process.env.PORT;\n',
  });
  assert.deepEqual(found['src/port.ts'], ['no-restricted-properties']);
  assert.deepEqual(found['src/environment.ts'], []);
});

test('the base preset refuses a .js relative import', async () => {
  const found = await lint(base, {
    'src/b.ts': 'export const b = 1;\n',
    'src/a.ts': "import { b } from './b.js';\n\nexport const a = b;\n",
  });
  assert.deepEqual(found['src/a.ts'], ['no-restricted-syntax']);
});

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

new RuleTester().run('multiline-arrow-needs-body', multilineArrowNeedsBody, {
  valid: [
    'const total = (sizes) => sizes.reduce((sum, size) => sum + size, 0);',
    'const big = (sizes) => {\n  return sizes.filter((size) => size > 10);\n};',
    'names.find((name) => {\n  return name.length > 3;\n});',
  ],
  invalid: [
    {
      code: 'const big = (sizes) =>\n  sizes.filter((size) => size > 10);',
      output: 'const big = (sizes) =>\n  {\n  return sizes.filter((size) => size > 10);\n};',
      errors: [{ messageId: 'needsBody' }],
    },
    {
      code: 'const pick = (names) => names.find((name) => {\n  return name.length > 3;\n});',
      output:
        'const pick = (names) => {\n  return names.find((name) => {\n  return name.length > 3;\n});\n};',
      errors: [{ messageId: 'needsBody' }],
    },
    {
      code: 'const row = (name) => (\n  [name, name]\n);',
      output: 'const row = (name) => {\n  return [name, name];\n};',
      errors: [{ messageId: 'needsBody' }],
    },
  ],
});
