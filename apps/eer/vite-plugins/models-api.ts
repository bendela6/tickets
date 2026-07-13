// Dev-only file-backed models API: apps/eer/models/<slug>.json behind
// /api/models. handleModelsRequest is the whole behavior (unit-testable);
// the plugin just adapts it to connect middleware. NOT part of the built app.

import { existsSync, mkdirSync } from 'node:fs';
import { readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Plugin } from 'vite';

import { loadModel } from '../src/engine/model/load-model';

const SLUG = /^[a-z0-9-]+$/;

function slugify(title: string): string {
  return title.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-').replaceAll(/^-+|-+$/g, '') || 'model';
}

// Concurrent renames that both target the same destination can transiently
// fail (observed on Windows as EPERM/EBUSY — two writers replacing the same
// path race at the OS level even though each has its own source file). The
// source is already fully written by this point, so retrying is always safe.
async function renameWithRetry(src: string, dest: string, attemptsLeft = 5): Promise<void> {
  try {
    await rename(src, dest);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (attemptsLeft <= 0 || (code !== 'EPERM' && code !== 'EBUSY' && code !== 'EACCES')) throw err;
    await new Promise((resolve) => setTimeout(resolve, 10));
    await renameWithRetry(src, dest, attemptsLeft - 1);
  }
}

async function atomicWrite(dir: string, slug: string, json: string): Promise<void> {
  // Tmp name is unique per call so concurrent writers to the same slug never
  // share a tmp path — otherwise one write's tmp file can be clobbered by
  // another's, or renamed away out from under it (ENOENT) before it gets to
  // rename its own.
  const tmp = join(dir, `.${slug}.${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`);
  await writeFile(tmp, json, 'utf8');
  await renameWithRetry(tmp, join(dir, `${slug}.json`));
}

function validate(body: string | null): { raw?: Record<string, unknown>; error?: { status: number; body: unknown } } {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(body ?? '') as Record<string, unknown>;
  } catch {
    return { error: { status: 400, body: { error: 'Body must be JSON.' } } };
  }
  const { errors } = loadModel(raw);
  if (errors.length) return { error: { status: 422, body: { error: errors.join(' ') } } };
  return { raw };
}

export async function handleModelsRequest(
  dir: string,
  method: string,
  url: string,
  body: string | null,
): Promise<{ status: number; body: unknown }> {
  mkdirSync(dir, { recursive: true });
  const slug = decodeURIComponent(url.replace(/^\//, '').split('?')[0] ?? '');

  if (!slug) {
    if (method === 'GET') {
      const files = (await readdir(dir)).filter((f) => f.endsWith('.json'));
      const entries = await Promise.all(
        files.map(async (f) => {
          // One unreadable/malformed file must not take down the whole
          // listing — skip it and let the rest of the models show up.
          try {
            const raw = JSON.parse(await readFile(join(dir, f), 'utf8')) as { meta?: { title?: string } };
            return { id: f.replace(/\.json$/, ''), title: raw.meta?.title ?? f };
          } catch {
            return null;
          }
        }),
      );
      const list = entries.filter((e): e is { id: string; title: string } => e !== null);
      return { status: 200, body: list.sort((a, b) => a.id.localeCompare(b.id)) };
    }
    if (method === 'POST') {
      const v = validate(body);
      if (v.error) return v.error;
      const title = ((v.raw!.meta as { title?: string } | undefined)?.title ?? 'model').toString();
      const id = slugify(title);
      if (existsSync(join(dir, `${id}.json`))) return { status: 409, body: { error: `Model "${id}" already exists.` } };
      await atomicWrite(dir, id, JSON.stringify(v.raw, null, 2));
      return { status: 201, body: { id } };
    }
    return { status: 405, body: { error: 'Method not allowed.' } };
  }

  if (!SLUG.test(slug)) return { status: 400, body: { error: 'Bad model id.' } };
  const file = join(dir, `${slug}.json`);
  if (method === 'GET') {
    if (!existsSync(file)) return { status: 404, body: { error: 'Not found.' } };
    return { status: 200, body: JSON.parse(await readFile(file, 'utf8')) };
  }
  if (method === 'PUT') {
    // A save to a slug with no file on disk is a client bug (e.g. Save fired
    // after the model was deleted), not an implicit create — 404 instead of
    // silently writing a new file back into existence.
    if (!existsSync(file)) return { status: 404, body: { error: 'Not found.' } };
    const v = validate(body);
    if (v.error) return v.error;
    await atomicWrite(dir, slug, JSON.stringify(v.raw, null, 2));
    return { status: 200, body: { id: slug } };
  }
  if (method === 'DELETE') {
    if (!existsSync(file)) return { status: 404, body: { error: 'Not found.' } };
    await rm(file);
    return { status: 200, body: { id: slug } };
  }
  return { status: 405, body: { error: 'Method not allowed.' } };
}

export function modelsApiPlugin(dir = join(process.cwd(), 'models')): Plugin {
  return {
    name: 'eer-models-api',
    configureServer(server) {
      server.middlewares.use('/api/models', (req, res) => {
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => {
          void handleModelsRequest(dir, req.method ?? 'GET', req.url ?? '/', chunks.length ? Buffer.concat(chunks).toString('utf8') : null)
            .then(({ status, body }) => {
              res.statusCode = status;
              res.setHeader('content-type', 'application/json');
              res.end(JSON.stringify(body));
            })
            .catch((err: unknown) => {
              res.statusCode = 500;
              res.setHeader('content-type', 'application/json');
              res.end(JSON.stringify({ error: String(err) }));
            });
        });
      });
    },
  };
}
