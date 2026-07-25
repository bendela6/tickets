// Dev-only drizzle schema reader/writer routes: /api/drizzle/schema (GET) and
// /api/drizzle/export (POST). Mirrors models-api.test.ts's approach — the
// request handlers are unit-tested directly; the vite plugin (drizzleApiPlugin)
// is a thin connect-middleware adapter around them and isn't separately tested.
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import * as realSchema from '../../../../packages/db/src/schema/index';
import {
  DEFAULT_MODULE,
  handleExportRequest,
  handleSchemaRequest,
  INSTRUMENT_PALETTE,
  mapSchemaGroups,
  resolveModulePath,
} from '../../vite-plugins/drizzle-api';

const ROOT = 'C:/workspace'; // synthetic, does not exist on disk — resolveModulePath
// falls back to pure lexical resolution whenever realpath can't touch a path
// (root or target), so these string-math assertions still hold post-realpath.

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

  it('describes the real @tickets/db schema end to end (30 tables)', async () => {
    const loader = { ssrLoadModule: () => Promise.resolve(realSchema as unknown as Record<string, unknown>) };
    const res = await handleSchemaRequest(loader, ROOT, null);
    expect(res.status).toBe(200);
    const body = res.body as { tables: unknown[]; groups: { key: string; color: string }[] };
    expect(body.tables).toHaveLength(30);
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

// ---- Finding 1: symlink containment (realpath, not lexical) --------------
//
// The lexical isInside() check validates a symlink's own location inside the
// workspace, not where it actually points. A symlink (or, unprivileged on
// Windows, a directory junction) planted inside the root and aimed outside
// it must still be rejected once resolveModulePath resolves real paths.
describe('resolveModulePath — symlink escape (finding 1)', () => {
  // Try a junction first: on Windows this needs no elevated privilege and
  // works for directories; on POSIX the 'junction' type argument is simply
  // ignored and a normal symlink is created (also unprivileged for a regular
  // user). Falls back to an explicit 'dir' symlink, then gives up.
  function makeEscapeLink(root: string, target: string): 'junction' | 'symlink' | null {
    const linkPath = join(root, 'escape.ts');
    try {
      symlinkSync(target, linkPath, 'junction');
      return 'junction';
    } catch {
      try {
        symlinkSync(target, linkPath, 'dir');
        return 'symlink';
      } catch {
        return null;
      }
    }
  }

  it('rejects a module path through a symlink whose real target resolves outside the workspace root', (ctx) => {
    const root = dir();
    const outside = dir(); // sibling tmp dir — never nested under root

    const created = makeEscapeLink(root, outside);
    ctx.skip(
      !created,
      'could not create a symlink or an unprivileged junction on this machine/account (EPERM on both) — skipping the finding-1 symlink-escape regression test',
    );

    const r = resolveModulePath(root, 'escape.ts');
    expect('error' in r).toBe(true);
    if ('error' in r) expect(r.error.status).toBe(400);
  });
});

// ---- Finding 2: INSTRUMENT_PALETTE drift guard ----------------------------
//
// INSTRUMENT_PALETTE hand-copies the --ins-opt-* light-mode hex values out of
// packages/web/ui/src/tokens.css. There is no shared source, so this test
// is the only thing standing between an Instrument palette change and a
// silently desynced drizzle-import zone colour. Mirrors the drift-test
// pattern in pg-types.test.ts (guarding the type catalogue against a drizzle
// upgrade) — a source-of-truth change should turn this red, not slip by.
const HERE = dirname(fileURLToPath(import.meta.url)); // apps/eer/src/test
const INSTRUMENT_CSS_PATH = resolve(HERE, '../../../../packages/web/ui/src/tokens.css');

function readLightModeOptPalette(): Record<string, string> {
  const css = readFileSync(INSTRUMENT_CSS_PATH, 'utf8');
  // The light block's selector is `:root, [data-theme='light'] {` since the
  // ThemeSplit change — match any selector list that starts at :root.
  const rootMatch = /:root[^{}]*\{/.exec(css);
  if (!rootMatch) throw new Error(':root block not found in instrument.css');
  const rootStart = rootMatch.index;
  const rootEnd = css.indexOf('\n}', rootStart);
  const lightBlock = css.slice(rootStart, rootEnd);

  // Matches only the base "--ins-opt-<name>: #hex;" declarations — the [a-z]+
  // capture can't cross the hyphen before "-hover"/"-subtle", and
  // "--ins-on-opt-*" never contains "--ins-opt-" as a substring — so those
  // variants are structurally excluded, not filtered after the fact.
  const found: Record<string, string> = {};
  const re = /--ins-opt-([a-z]+):\s*(#[0-9a-fA-F]{6})\s*;/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(lightBlock))) found[m[1]!] = m[2]!.toLowerCase();
  return found;
}

describe('INSTRUMENT_PALETTE (finding 2 — drift guard)', () => {
  it('matches the --ins-opt-* light-mode hex values in instrument.css', () => {
    const found = readLightModeOptPalette();
    // Sanity check the parser actually found the whole named set, so a CSS
    // markup change can't silently make this assertion vacuous.
    expect(Object.keys(found).sort()).toEqual(Object.keys(INSTRUMENT_PALETTE).sort());
    expect(found).toEqual(INSTRUMENT_PALETTE);
  });
});
