// Dev-only drizzle schema reader/writer routes: /api/drizzle/schema (GET) and
// /api/drizzle/export (POST). Mirrors models-api.test.ts's approach — the
// request handlers are unit-tested directly; the vite plugin (drizzleApiPlugin)
// is a thin connect-middleware adapter around them and isn't separately tested.
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import * as realSchema from '../../../../packages/db/src/schema/index';
import {
  DEFAULT_MODULE,
  handleExportRequest,
  handleSchemaRequest,
  mapSchemaGroups,
  resolveModulePath,
} from '../../vite-plugins/drizzle-api';

const ROOT = 'C:/workspace'; // synthetic — resolveModulePath only does string math, never touches disk

// Track every mkdtempSync dir so it can be removed after its test.
const createdDirs: string[] = [];
const dir = () => {
  const d = mkdtempSync(join(tmpdir(), 'eer-drizzle-'));
  createdDirs.push(d);
  return d;
};

afterEach(() => {
  for (const d of createdDirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe('resolveModulePath', () => {
  it('defaults to packages/db/src/schema/index.ts', () => {
    const r = resolveModulePath(ROOT, null);
    expect('error' in r).toBe(false);
    if ('path' in r) expect(r.path.replaceAll('\\', '/')).toBe(`${ROOT}/${DEFAULT_MODULE}`);
  });

  it('rejects a path that escapes the workspace root', () => {
    expect(resolveModulePath(ROOT, '../../etc/passwd')).toEqual({
      error: { status: 400, body: { error: expect.any(String) } },
    });
  });

  it('rejects a traversal that still ends in .ts', () => {
    const r = resolveModulePath(ROOT, '../../../secrets.ts');
    expect('error' in r).toBe(true);
    if ('error' in r) expect(r.error.status).toBe(400);
  });

  it('rejects an absolute path outside the root', () => {
    const r = resolveModulePath(ROOT, 'C:/Windows/system32/config.ts');
    expect('error' in r).toBe(true);
    if ('error' in r) expect(r.error.status).toBe(400);
  });

  it('rejects a non-.ts module path', () => {
    const r = resolveModulePath(ROOT, 'packages/db/src/schema/index.js');
    expect('error' in r).toBe(true);
    if ('error' in r) expect(r.error.status).toBe(400);
  });

  it('accepts a .ts path that resolves inside the root', () => {
    const r = resolveModulePath(ROOT, 'packages/db/src/schema/index.ts');
    expect('error' in r).toBe(false);
  });
});

describe('handleSchemaRequest', () => {
  it('returns 422 with the message when the module throws on load', async () => {
    const loader = { ssrLoadModule: () => Promise.reject(new Error('boom: bad import')) };
    const res = await handleSchemaRequest(loader, ROOT, null);
    expect(res.status).toBe(422);
    expect(res.body).toEqual({ error: 'boom: bad import' });
  });

  it('never lets a throwing module reach the client as a 500', async () => {
    const loader = { ssrLoadModule: () => Promise.reject('not even an Error instance') };
    const res = await handleSchemaRequest(loader, ROOT, null);
    expect(res.status).toBe(422);
  });

  it('400s before ever calling the loader for a bad module path', async () => {
    let called = false;
    const loader = { ssrLoadModule: () => { called = true; return Promise.resolve({}); } };
    const res = await handleSchemaRequest(loader, ROOT, '../../etc/passwd');
    expect(res.status).toBe(400);
    expect(called).toBe(false);
  });

  it('describes the real @tickets/db schema end to end (18 tables)', async () => {
    const loader = { ssrLoadModule: () => Promise.resolve(realSchema as unknown as Record<string, unknown>) };
    const res = await handleSchemaRequest(loader, ROOT, null);
    expect(res.status).toBe(200);
    const body = res.body as { tables: unknown[]; groups: { key: string; color: string }[] };
    expect(body.tables).toHaveLength(18);
    // group colours are resolved to hex, not left as Instrument names
    for (const g of body.groups) expect(g.color).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe('mapSchemaGroups (colour name -> hex)', () => {
  it('resolves known Instrument colour names to hex', () => {
    const out = mapSchemaGroups([{ key: 'k', label: 'L', color: 'indigo', tables: ['t'] }]);
    expect(out).toEqual([{ key: 'k', label: 'L', color: expect.stringMatching(/^#[0-9a-f]{6}$/i), tables: ['t'] }]);
  });

  it('falls back to a default palette entry for an unknown colour name', () => {
    const out = mapSchemaGroups([{ key: 'k', label: 'L', color: 'chartreuse-mystery', tables: [] }]);
    expect(out[0]!.color).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe('handleExportRequest', () => {
  it('writes the export atomically and returns its path', async () => {
    const d = dir();
    const res = await handleExportRequest(d, JSON.stringify({ filename: 'schema.generated.ts', source: 'export const x = 1;\n' }));
    expect(res.status).toBe(200);
    const file = join(d, 'schema.generated.ts');
    expect(existsSync(file)).toBe(true);
    expect(readFileSync(file, 'utf8')).toBe('export const x = 1;\n');
    // no stray tmp files left behind
    expect(readdirSync(d)).toEqual(['schema.generated.ts']);
  });

  it('rejects a traversing filename with 400 and writes nothing', async () => {
    const d = dir();
    const res = await handleExportRequest(d, JSON.stringify({ filename: '../../packages/db/src/schema/index.ts', source: 'x' }));
    expect(res.status).toBe(400);
    expect(readdirSync(d)).toEqual([]);
  });

  it('rejects a filename with a path separator', () => {
    const d = dir();
    return handleExportRequest(d, JSON.stringify({ filename: 'sub/dir.ts', source: 'x' })).then((res) => {
      expect(res.status).toBe(400);
      expect(readdirSync(d)).toEqual([]);
    });
  });

  it('rejects a non-JSON body with 400', async () => {
    const d = dir();
    const res = await handleExportRequest(d, '{not json');
    expect(res.status).toBe(400);
  });
});
