import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { beforeAll, expect, it } from 'vitest';
import { buildApp } from '../app';

const require = createRequire(import.meta.url);
let sdkPath: string;

try {
  const pkgPath = require.resolve('@bendela6/signals-browser/package.json');
  sdkPath = join(dirname(pkgPath), 'dist', 'sdk.js');
} catch {
  throw new Error('Unable to resolve @bendela6/signals-browser/package.json');
}

beforeAll(() => {
  if (!existsSync(sdkPath)) {
    execSync('pnpm --filter @bendela6/signals-browser build', { stdio: 'ignore' });
  }
}, 120_000);

it('GET /sdk.js serves the browser IIFE with open CORS', async () => {
  const app = buildApp({ db: null as never });
  const res = await app.inject({ method: 'GET', url: '/sdk.js' });
  expect(res.statusCode).toBe(200);
  expect(res.headers['content-type']).toContain('javascript');
  expect(res.headers['access-control-allow-origin']).toBe('*');
  expect(res.body).toContain('Signals');
  await app.close();
});
