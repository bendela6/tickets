// Dev-only routes bridging the browser to the Node-side drizzle reader/writer:
//   GET  /api/drizzle/schema?module=<path>  -> SchemaDescription
//   POST /api/drizzle/export {filename, source} -> writes the exported file
//
// Sibling to models-api.ts rather than folded into it: models-api owns a
// small, closed CRUD surface over apps/eer/models/*.json (one directory, one
// file shape). This module has a materially different security surface — an
// arbitrary caller-supplied *code* path is loaded and executed via
// ssrLoadModule, and the write side must never be allowed anywhere near
// packages/db. Keeping the "load and run someone's TypeScript" route in its
// own file makes that boundary a file boundary, not just a convention.
//
// handleSchemaRequest / handleExportRequest are the whole behavior
// (unit-testable, same shape as handleModelsRequest); drizzleApiPlugin just
// adapts them to connect middleware. NOT part of the built app: this plugin
// only implements configureServer, which Vite invokes for `vite dev`/`vite
// serve` but never for `vite build` — so the production bundle has no
// filesystem or ssrLoadModule surface at all (same mechanism models-api.ts
// relies on).
import { mkdirSync } from 'node:fs';
import { rename, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

import { describeDrizzle } from '../src/node/describe-drizzle';
import type { SchemaGroupDescription } from '../src/node/describe-drizzle';
// Relative import straight to the data module (not the @tickets/db package
// root, and not even the schema barrel) — schema-groups.ts has no imports of
// its own, so this never risks pulling in client.ts's live DB connection.
import { SCHEMA_GROUPS, type SchemaGroup } from '../../../packages/db/src/schema/schema-groups';

const HERE = dirname(fileURLToPath(import.meta.url)); // apps/eer/vite-plugins
export const DEFAULT_ROOT = resolve(HERE, '..', '..', '..'); // workspace root
export const DEFAULT_EXPORTS_DIR = resolve(HERE, '..', 'exports'); // apps/eer/exports
export const DEFAULT_MODULE = 'packages/db/src/schema/index.ts';

// ---- schema read side ---------------------------------------------------

// Structural subset of ViteDevServer — lets tests pass a stub instead of a
// real dev server.
export interface ModuleLoader {
  ssrLoadModule(id: string): Promise<Record<string, unknown>>;
}

function isInside(root: string, target: string): boolean {
  const rel = relative(root, target);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

export function resolveModulePath(
  root: string,
  requested: string | null,
): { path: string } | { error: { status: number; body: unknown } } {
  const rel = requested && requested.trim() !== '' ? requested : DEFAULT_MODULE;
  if (!rel.endsWith('.ts')) {
    return { error: { status: 400, body: { error: 'Module path must end in .ts.' } } };
  }
  const abs = resolve(root, rel);
  if (!isInside(root, abs)) {
    return { error: { status: 400, body: { error: 'Module path must resolve inside the workspace.' } } };
  }
  return { path: abs };
}

// Instrument's option palette (light-mode hex — see apps/web/src/styles/instrument.css).
// The schema-groups declare a colour by NAME (e.g. 'indigo'); the model wants
// hex, so it's resolved here, once, at the read boundary. An unknown name
// (typo, future palette addition not yet wired here) falls back to gray
// rather than failing the whole schema read.
const INSTRUMENT_PALETTE: Record<string, string> = {
  red: '#a03028',
  orange: '#a44e14',
  yellow: '#8a6a10',
  green: '#2e7042',
  teal: '#176d5c',
  cyan: '#14687e',
  blue: '#2a5dae',
  indigo: '#4a44b0',
  purple: '#7b3fa0',
  pink: '#a63368',
  gray: '#5c594f',
};
const DEFAULT_HEX = INSTRUMENT_PALETTE.gray!;

export function mapSchemaGroups(groups: SchemaGroup[]): SchemaGroupDescription[] {
  return groups.map((g) => ({
    key: g.key,
    label: g.label,
    color: INSTRUMENT_PALETTE[g.color] ?? DEFAULT_HEX,
    tables: g.tables,
  }));
}

export async function handleSchemaRequest(
  loader: ModuleLoader,
  root: string,
  moduleParam: string | null,
): Promise<{ status: number; body: unknown }> {
  const resolved = resolveModulePath(root, moduleParam);
  if ('error' in resolved) return resolved.error;

  let mod: Record<string, unknown>;
  try {
    mod = await loader.ssrLoadModule(resolved.path);
  } catch (err) {
    // A module that fails to load (syntax error, a throwing top-level
    // statement, an unresolved import) is a 422 with the message — never a
    // crash, and never a 500 stack trace leaked to the client.
    return { status: 422, body: { error: err instanceof Error ? err.message : String(err) } };
  }

  return { status: 200, body: describeDrizzle(mod, mapSchemaGroups(SCHEMA_GROUPS)) };
}

// ---- export write side ---------------------------------------------------

// Deliberately narrow: no path separators of either flavor, so `join(dir,
// filename)` can never climb out of `dir` regardless of platform.
const EXPORT_FILENAME = /^[A-Za-z0-9._-]+\.ts$/;

// Same tmp-write-then-rename dance as models-api.ts's atomicWrite, and the
// same retry rationale (concurrent renames to the same destination can
// transiently EPERM/EBUSY/EACCES on Windows even with distinct source files).
async function renameWithRetry(src: string, dest: string, attemptsLeft = 5): Promise<void> {
  try {
    await rename(src, dest);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (attemptsLeft <= 0 || (code !== 'EPERM' && code !== 'EBUSY' && code !== 'EACCES')) throw err;
    await new Promise((res) => setTimeout(res, 10));
    await renameWithRetry(src, dest, attemptsLeft - 1);
  }
}

async function atomicWrite(dir: string, filename: string, contents: string): Promise<void> {
  mkdirSync(dir, { recursive: true });
  const tmp = join(dir, `.${filename}.${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`);
  await writeFile(tmp, contents, 'utf8');
  await renameWithRetry(tmp, join(dir, filename));
}

export async function handleExportRequest(dir: string, body: string | null): Promise<{ status: number; body: unknown }> {
  let raw: { filename?: unknown; source?: unknown };
  try {
    raw = JSON.parse(body ?? '') as { filename?: unknown; source?: unknown };
  } catch {
    return { status: 400, body: { error: 'Body must be JSON.' } };
  }
  const filename = typeof raw.filename === 'string' ? raw.filename : '';
  const source = typeof raw.source === 'string' ? raw.source : '';
  if (!EXPORT_FILENAME.test(filename)) {
    return { status: 400, body: { error: 'Bad export filename — no path separators, must end in .ts.' } };
  }
  await atomicWrite(dir, filename, source);
  return { status: 200, body: { path: join(dir, filename) } };
}

// ---- vite plugin ----------------------------------------------------------

export function drizzleApiPlugin(root = DEFAULT_ROOT, exportsDir = DEFAULT_EXPORTS_DIR): Plugin {
  return {
    name: 'eer-drizzle-api',
    configureServer(server) {
      server.middlewares.use('/api/drizzle', (req, res) => {
        const [pathname, search] = (req.url ?? '/').split('?');
        const respond = ({ status, body }: { status: number; body: unknown }) => {
          res.statusCode = status;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify(body));
        };
        const fail = (err: unknown) => respond({ status: 500, body: { error: String(err) } });

        if (pathname === '/schema' && req.method === 'GET') {
          const moduleParam = new URLSearchParams(search ?? '').get('module');
          void handleSchemaRequest(server, root, moduleParam).then(respond).catch(fail);
          return;
        }

        if (pathname === '/export' && req.method === 'POST') {
          const chunks: Buffer[] = [];
          req.on('data', (c: Buffer) => chunks.push(c));
          req.on('end', () => {
            void handleExportRequest(exportsDir, chunks.length ? Buffer.concat(chunks).toString('utf8') : null)
              .then(respond)
              .catch(fail);
          });
          return;
        }

        respond({ status: 404, body: { error: 'Not found.' } });
      });
    },
  };
}
