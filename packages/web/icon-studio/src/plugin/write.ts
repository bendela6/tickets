import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
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
 * temp-then-rename keeps a failed write from leaving a truncated icon, and if
 * the write or the rename itself fails, the temp file is removed before the
 * error is rethrown so a failed generate leaves no debris next to the real
 * asset. (A process kill mid-write is out of scope — nothing running inside
 * the process can clean up after that.)
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
  try {
    await writeFile(tmp, bytes);
    await rename(tmp, abs);
  } catch (err) {
    // Best-effort cleanup only — a failure here must never mask the error
    // that caused the write/rename to fail in the first place.
    await unlink(tmp).catch(() => {});
    throw err;
  }
  return 'written';
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function assertHexColor(value: unknown, field: string): string {
  if (typeof value !== 'string' || !HEX_COLOR.test(value)) {
    throw new Error(`${field} must be a 6-digit hex color`);
  }
  return value;
}

function assertColorTriple(value: unknown, field: string): [string, string, string] {
  if (!Array.isArray(value) || value.length !== 3) {
    throw new Error(`${field} must be a triple`);
  }
  return [
    assertHexColor(value[0], `${field}[0]`),
    assertHexColor(value[1], `${field}[1]`),
    assertHexColor(value[2], `${field}[2]`),
  ];
}

function assertFiniteNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${field} must be a finite number`);
  }
  return value;
}

function assertAngleTriple(value: unknown, field: string): [number, number, number] {
  if (!Array.isArray(value) || value.length !== 3) {
    throw new Error(`${field} must be a triple`);
  }
  return [
    assertFiniteNumber(value[0], `${field}[0]`),
    assertFiniteNumber(value[1], `${field}[1]`),
    assertFiniteNumber(value[2], `${field}[2]`),
  ];
}

function assertPositiveWeight(value: unknown, field: string): number {
  const n = assertFiniteNumber(value, field);
  if (n <= 0) throw new Error(`${field} must be a finite number greater than zero`);
  return n;
}

/**
 * Every colour and number is validated before anything is derived or
 * written. These raw values are template-interpolated *unescaped* into SVG
 * and HTML attributes downstream (`generate/svg.ts` writes `stroke="…"` and
 * `fill="…"`; `generate/head.ts` writes `color="…"` and `content="…"`), so an
 * unvalidated field is not just a crash risk — an unchecked `chip` could
 * break out of an attribute and persist chosen markup into the repo's real,
 * hand-maintained `apps/web/index.html`. Anchoring the hex pattern at both
 * ends also rejects 3-digit shorthand, `rgb()`, and named colours: the
 * generators and the written `icons.config.json` all assume 6-digit hex.
 */
function assertRequest(body: unknown): GenerateRequest {
  if (typeof body !== 'object' || body === null) throw new Error('body must be an object');
  const { config, pngs } = body as { config?: unknown; pngs?: Record<string, string> };
  if (typeof config !== 'object' || config === null) throw new Error('body.config is required');
  const c = config as Record<string, unknown>;

  const validConfig: MarkConfig = {
    light: assertColorTriple(c.light, 'body.config.light'),
    dark: assertColorTriple(c.dark, 'body.config.dark'),
    chip: assertHexColor(c.chip, 'body.config.chip'),
    angles: assertAngleTriple(c.angles, 'body.config.angles'),
    bareWeight: assertPositiveWeight(c.bareWeight, 'body.config.bareWeight'),
    chipReach: assertPositiveWeight(c.chipReach, 'body.config.chipReach'),
    chipWeight: assertPositiveWeight(c.chipWeight, 'body.config.chipWeight'),
  };

  return { config: validConfig, pngs: pngs ?? {} };
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
    const abs = resolveOutput(name, repoRoot);
    if (abs === null) {
      // The four keys above are hardcoded and always members of OUTPUTS —
      // this can only fire if the two tables are ever allowed to drift, and
      // it must fail loudly rather than via a silently-asserted non-null.
      throw new Error(`internal error: derived output "${name}" is not a known output`);
    }
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
  // injectHeadBlock throws on malformed marker states (one marker present
  // without the other, markers reversed, or no </head>). By the time we get
  // here, six or seven files may already have been written, so that throw
  // must not propagate out and discard the results already collected — it
  // becomes a rejected entry for this one path instead.
  const indexPath = path.resolve(repoRoot, 'apps/web/index.html');
  try {
    const html = await readFile(indexPath, 'utf8');
    const merged = injectHeadBlock(html, buildHeadBlock(config));
    const bytes = Buffer.from(merged, 'utf8');
    const status = await writeIfChanged(indexPath, bytes);
    results.push({ path: rel(indexPath), bytes: bytes.byteLength, status });
  } catch (err) {
    results.push({
      path: rel(indexPath),
      bytes: 0,
      status: 'rejected',
      reason: err instanceof Error ? err.message : String(err),
    });
  }

  return { results };
}
