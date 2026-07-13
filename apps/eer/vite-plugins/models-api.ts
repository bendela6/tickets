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

async function atomicWrite(dir: string, slug: string, json: string): Promise<void> {
  const tmp = join(dir, `.${slug}.tmp`);
  await writeFile(tmp, json, 'utf8');
  await rename(tmp, join(dir, `${slug}.json`));
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
      const list = await Promise.all(
        files.map(async (f) => {
          const raw = JSON.parse(await readFile(join(dir, f), 'utf8')) as { meta?: { title?: string } };
          return { id: f.replace(/\.json$/, ''), title: raw.meta?.title ?? f };
        }),
      );
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
              res.end(JSON.stringify({ error: String(err) }));
            });
        });
      });
    },
  };
}
