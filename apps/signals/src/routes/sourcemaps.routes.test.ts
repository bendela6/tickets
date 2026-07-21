import { afterAll, beforeEach, expect, it } from 'vitest';
import { buildApp } from '../app';
import { issues, signals } from '../db/schema';
import { resetDb, testDb } from '../test/db';

beforeEach(resetDb);
afterAll(resetDb);

// Same fixture as symbolicate.test.ts — a tiny real source map for
// `function boom(){throw new Error("x")}` from src/boom.ts, generated with
// esbuild --minify --sourcemap.
const MAP = JSON.stringify({
  version: 3,
  sources: ['src/boom.ts'],
  sourcesContent: ['function boom() {\n  throw new Error("x");\n}\nboom();\n'],
  mappings: 'AAAA,SAAS,MAAO,CACd,MAAM,IAAI,MAAM,GAAG,CACrB,CACA,KAAK',
  names: [],
});

it('stores maps and symbolicates subsequent error ingests, refreshing culprit', async () => {
  const app = buildApp({ db: testDb });
  const a = (await app.inject({ method: 'POST', url: '/apps', payload: { name: 'A' } })).json();

  const up = await app.inject({
    method: 'POST', url: `/ingest/${a.ingestKey}/sourcemaps`,
    payload: { release: '1.0.0', files: [{ filename: 'index-8f3a91.js.map', content: MAP }] },
  });
  expect(up.statusCode).toBe(201);
  expect(up.json()).toEqual({ stored: 1 });

  await app.inject({
    method: 'POST', url: `/ingest/${a.ingestKey}`,
    payload: { signals: [{
      kind: 'error', sessionId: 's', name: 'Error', message: 'x',
      mechanism: 'uncaught-exception', level: 'error', timestamp: new Date().toISOString(),
      release: '1.0.0',
      stack: [{ functionName: 'r', file: '/assets/index-8f3a91.js', line: 1, column: 21, inApp: false }],
      platform: { runtime: 'browser' }, sdk: { name: 't', version: '0' },
    }] },
  });

  const [signalRow] = await testDb.select().from(signals);
  expect(signalRow!.payload.stackSymbolicated).toBeDefined();
  expect(signalRow!.payload.stackSymbolicated![0]!.file).toContain('src/boom.ts');
  const [issueRow] = await testDb.select().from(issues);
  expect(issueRow!.culprit).toContain('src/boom.ts');
  await app.close();
});

it('403s on a bad key and 400s without release', async () => {
  const app = buildApp({ db: testDb });
  const a = (await app.inject({ method: 'POST', url: '/apps', payload: { name: 'A' } })).json();
  expect((await app.inject({ method: 'POST', url: '/ingest/pub_bad/sourcemaps', payload: { release: '1', files: [] } })).statusCode).toBe(403);
  expect((await app.inject({ method: 'POST', url: `/ingest/${a.ingestKey}/sourcemaps`, payload: { files: [] } })).statusCode).toBe(400);
  await app.close();
});
