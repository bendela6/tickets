/// <reference types="node" />
// This package's tsconfig deliberately omits ambient Node types (`"types": []`)
// so browser runtime code never sees Node globals — but this test drives a
// classic-script `<script>` load via Node's child_process/fs/vm, so it opts in
// locally via the triple-slash reference above instead of widening the
// package-wide `types` array.
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { beforeAll, expect, it } from 'vitest';

// Regression test for the tsup `globalName: 'Signals'` IIFE build: auto.ts must
// `export { initSignals, getClient }` so the IIFE's implicit return populates
// `var Signals`. Without that export, the classic-script wrapper assigns
// `Signals = undefined` (or `{}`) over the `window.Signals = {...}` line executed
// inside the IIFE body — this test exercises the built dist/sdk.js exactly the
// way a `<script src="/sdk.js">` tag would load it, so it catches that class of bug
// even though every unit test that imports auto.ts as an ES module passes fine.

const __dirname = dirname(fileURLToPath(import.meta.url));
const sdkPath = join(__dirname, '..', 'dist', 'sdk.js');

beforeAll(() => {
  if (!existsSync(sdkPath)) {
    execSync('pnpm --filter @bendela6/signals-browser build', { stdio: 'ignore' });
  }
}, 120_000);

it('window.Signals exposes initSignals and getClient after the classic-script IIFE runs', () => {
  const code = readFileSync(sdkPath, 'utf8');

  // Minimal browser-shaped sandbox. `window` self-references the sandbox itself,
  // matching how `vm.runInNewContext` contextifies the sandbox object as the
  // script's global object — a top-level `var Signals = ...` in the IIFE wrapper
  // therefore lands as `sandbox.Signals`, which is the same object as
  // `sandbox.window.Signals` since `window === sandbox`.
  const sandbox: Record<string, unknown> = {};
  sandbox.window = sandbox;
  sandbox.document = { currentScript: null };
  sandbox.navigator = {};
  sandbox.location = { href: 'http://x/' };
  sandbox.console = console;
  // auto.ts guards `document.currentScript` with `instanceof HTMLScriptElement`;
  // the real DOM global isn't available in this sandbox, so stand in a class
  // that nothing will ever actually be an instance of (currentScript is null).
  sandbox.HTMLScriptElement = class HTMLScriptElement {};

  vm.runInNewContext(code, sandbox, { filename: 'sdk.js' });

  const signals = (sandbox.window as { Signals?: { initSignals?: unknown; getClient?: unknown } }).Signals;
  expect(typeof signals?.initSignals).toBe('function');
  expect(typeof signals?.getClient).toBe('function');
});
