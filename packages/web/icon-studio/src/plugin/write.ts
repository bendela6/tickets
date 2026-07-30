import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { MarkConfig } from '../config';
import { buildHeadBlock, injectHeadBlock } from '../generate/head';
import { buildManifest } from '../generate/manifest';
import { svgFavicon, svgMono } from '../generate/svg';
import { PNG_NAMES, resolveOutput } from './outputs';
import { decodePng } from './validate';

export interface GenerateRequest {
  config: MarkConfig;
  /** base64 PNG per name. Only a browser can produce these. */
  pngs: Record<string, string>;
}

export interface GenerateResult {
  /** Repo-relative path, or the offending name when rejected. */
  path: string;
  bytes: number;
  status: 'written' | 'unchanged' | 'rejected';
  reason?: string;
}

export interface GenerateResponse {
  results: GenerateResult[];
}

/**
 * Write only when the bytes differ, so re-running Generate on an unchanged
 * config leaves mtimes alone and shows up as nothing in `git status`. The
 * temp-then-rename keeps a failed write from leaving a truncated icon.
 */
export async function writeIfChanged(abs: string, bytes: Buffer): Promise<'written' | 'unchanged'> {
  try {
    const existing = await readFile(abs);
    if (existing.equals(bytes)) return 'unchanged';
  } catch {
    // Missing file — fall through and write it.
  }
  await mkdir(path.dirname(abs), { recursive: true });
  const tmp = `${abs}.tmp`;
  await writeFile(tmp, bytes);
  await rename(tmp, abs);
  return 'written';
}

function assertRequest(body: unknown): GenerateRequest {
  if (typeof body !== 'object' || body === null) throw new Error('body must be an object');
  const { config, pngs } = body as Partial<GenerateRequest>;
  if (typeof config !== 'object' || config === null) throw new Error('body.config is required');
  for (const key of ['light', 'dark', 'angles'] as const) {
    if (!Array.isArray(config[key]) || config[key].length !== 3) {
      throw new Error(`body.config.${key} must be a triple`);
    }
  }
  if (typeof config.chip !== 'string') throw new Error('body.config.chip must be a string');
  return { config, pngs: pngs ?? {} };
}

export async function runGenerate(body: unknown, repoRoot: string): Promise<GenerateResponse> {
  const { config, pngs } = assertRequest(body);
  const results: GenerateResult[] = [];
  const rel = (abs: string) => path.relative(repoRoot, abs).split(path.sep).join('/');

  // Everything derivable is derived here, not trusted from the client.
  const derived: Record<string, Buffer> = {
    'favicon.svg': Buffer.from(svgFavicon(config), 'utf8'),
    'icon-mono.svg': Buffer.from(svgMono(config), 'utf8'),
    'site.webmanifest': Buffer.from(buildManifest(config), 'utf8'),
    'icons.config.json': Buffer.from(JSON.stringify(config, null, 2) + '\n', 'utf8'),
  };

  for (const [name, bytes] of Object.entries(derived)) {
    const abs = resolveOutput(name, repoRoot)!;
    const status = await writeIfChanged(abs, bytes);
    results.push({ path: rel(abs), bytes: bytes.byteLength, status });
  }

  for (const [name, payload] of Object.entries(pngs)) {
    if (!(PNG_NAMES as readonly string[]).includes(name)) {
      results.push({ path: name, bytes: 0, status: 'rejected', reason: 'not an allowed output' });
      continue;
    }
    const abs = resolveOutput(name, repoRoot);
    if (abs === null) {
      results.push({ path: name, bytes: 0, status: 'rejected', reason: 'not an allowed output' });
      continue;
    }
    const decoded = decodePng(payload);
    if (!decoded.ok) {
      results.push({ path: rel(abs), bytes: 0, status: 'rejected', reason: decoded.reason });
      continue;
    }
    const status = await writeIfChanged(abs, decoded.bytes);
    results.push({ path: rel(abs), bytes: decoded.bytes.byteLength, status });
  }

  // index.html is hand-maintained: merge the marked block, never overwrite.
  const indexPath = path.resolve(repoRoot, 'apps/web/index.html');
  const html = await readFile(indexPath, 'utf8');
  const merged = injectHeadBlock(html, buildHeadBlock(config));
  const bytes = Buffer.from(merged, 'utf8');
  const status = await writeIfChanged(indexPath, bytes);
  results.push({ path: rel(indexPath), bytes: bytes.byteLength, status });

  return { results };
}
