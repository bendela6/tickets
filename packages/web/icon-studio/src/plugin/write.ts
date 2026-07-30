import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  ELEMENT_TYPES, INK_RESOLUTIONS,
  type Element, type IconDoc, type Ink, type MotionConfig, type Variant,
} from '../doc';
import { buildHeadBlock, injectHeadBlock } from '../generate/head';
import { buildManifest } from '../generate/manifest';
import { renderSvg, resolveInk } from '../generate/render';
import { PNG_NAMES, resolveOutput } from './outputs';
import { decodePng } from './validate';

export interface GenerateRequest {
  config: IconDoc;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function assertHexColor(value: unknown, field: string): string {
  if (typeof value !== 'string' || !HEX_COLOR.test(value)) {
    throw new Error(`${field} must be a 6-digit hex color`);
  }
  return value;
}

function assertFiniteNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${field} must be a finite number`);
  }
  return value;
}

function assertPositiveWeight(value: unknown, field: string): number {
  const n = assertFiniteNumber(value, field);
  if (n <= 0) throw new Error(`${field} must be a finite number greater than zero`);
  return n;
}

function assertNonNegative(value: unknown, field: string): number {
  const n = assertFiniteNumber(value, field);
  if (n < 0) throw new Error(`${field} must not be negative`);
  return n;
}

/**
 * The motion block is required, not defaulted.
 *
 * `runGenerate` writes the validated config straight back to
 * `icons.config.json`, so quietly substituting defaults for a missing block
 * would overwrite a developer's tuned values with stock ones and report it as a
 * normal write — the same silent-data-loss shape as the config read that used
 * to fall back to defaults on any error. A client that omits it gets a 400
 * instead. `speed` must be positive because the stagger divides by it; `ramp`
 * and `restSpread` may be zero (an instant ramp and a fully-stacked rest pose
 * are both legitimate), but not negative.
 */
function assertMotion(value: unknown, field: string): MotionConfig {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${field} must be an object`);
  }
  const m = value as Record<string, unknown>;
  if (m.restPose !== 'logo' && m.restPose !== 'fan') {
    throw new Error(`${field}.restPose must be "logo" or "fan"`);
  }
  return {
    speed: assertPositiveWeight(m.speed, `${field}.speed`),
    restSpread: assertNonNegative(m.restSpread, `${field}.restSpread`),
    ramp: assertNonNegative(m.ramp, `${field}.ramp`),
    restPose: m.restPose,
  };
}

/**
 * `config` is validated exhaustively above, but `pngs`' values were only ever
 * trusted as `Record<string, string>` by a cast — so `{"icon-192.png": 123}`
 * would reach `decodePng`, which calls `.replace` on it and throws a raw
 * `payload.replace is not a function` instead of a clean rejection. Checking
 * the shape here, before anything is derived or written, keeps a malformed
 * `pngs` entry from ever reaching that point — consistent with why `config`
 * is validated up front instead of failing wherever it's first used.
 */
function assertPngs(value: unknown, field: string): Record<string, string> {
  if (value === undefined) return {};
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${field} must be an object`);
  }
  const out: Record<string, string> = {};
  for (const [name, payload] of Object.entries(value as Record<string, unknown>)) {
    if (typeof payload !== 'string') {
      throw new Error(`${field}["${name}"] must be a base64-encoded string`);
    }
    out[name] = payload;
  }
  return out;
}

function assertString(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  return value;
}

/** Letters, digits, hyphen, underscore — matches the `${type}-${n}` ids the
 * studio itself generates (`freshId` in state.ts) and the bare `top`/`mid`/`low`
 * ids the locked mark uses, so this never rejects a legitimate document. */
const SAFE_ID = /^[A-Za-z0-9_-]+$/;

/**
 * `id` gets its own validator rather than `assertString` because it reaches a
 * third, distinct unescaped sink beyond SVG/HTML attributes (see the comment
 * on `assertIconDoc`): `apps/web/src/components/shell/brand-mark.tsx`
 * interpolates it straight into a CSS custom-property *name*
 * (`--brand-${element.id}`). A space there breaks the declaration; a `;` or
 * `}` closes it and lets the rest of the id inject further CSS into
 * apps/web's bundled stylesheet. Anchoring to a safe charset — not just
 * "is a string" — is what closes that off.
 */
function assertElementId(value: unknown, field: string): string {
  const id = assertString(value, field);
  if (!SAFE_ID.test(id)) {
    throw new Error(`${field} must contain only letters, digits, hyphens and underscores`);
  }
  return id;
}

function assertInk(value: unknown, field: string): Ink {
  if (!isRecord(value)) throw new Error(`${field} must be an object`);
  return {
    light: assertHexColor(value.light, `${field}.light`),
    dark: assertHexColor(value.dark, `${field}.dark`),
  };
}

function assertElement(value: unknown, field: string): Element {
  if (!isRecord(value)) throw new Error(`${field} must be an object`);
  const id = assertElementId(value.id, `${field}.id`);
  const ink = assertString(value.ink, `${field}.ink`);
  // Always a real boolean, never `undefined`: `JSON.stringify` (in
  // `runGenerate`, writing `icons.config.json`) drops `undefined`-valued
  // keys entirely, so a `spin: undefined` here would round-trip as *no*
  // `spin` key at all. On reopen, `toDoc`'s pass-through branch leaves that
  // element without one, and `studioReducer`'s `updateElement` guard
  // (state.ts) only ever applies a patch key already present on the target
  // element — so a later attempt to turn spin back on would dispatch a patch
  // the guard silently drops. Same interaction bug Task 8 fixed for
  // freshly-added elements (`blankElement` in state.ts), on the other side
  // of the persistence seam.
  const spin = value.spin === true;
  const type = value.type;
  if (type !== 'stick' && type !== 'ring' && type !== 'dot') {
    throw new Error(`${field}.type must be one of ${ELEMENT_TYPES.join(', ')}`);
  }
  switch (type) {
    case 'stick':
      return {
        id, ink, spin, type,
        angle: assertFiniteNumber(value.angle, `${field}.angle`),
        reach: assertPositiveWeight(value.reach, `${field}.reach`),
        weight: assertPositiveWeight(value.weight, `${field}.weight`),
      };
    case 'ring':
      return {
        id, ink, spin, type,
        radius: assertPositiveWeight(value.radius, `${field}.radius`),
        weight: assertPositiveWeight(value.weight, `${field}.weight`),
      };
    case 'dot': {
      const at = value.at;
      if (!Array.isArray(at) || at.length !== 2) throw new Error(`${field}.at must be a pair`);
      return {
        id, ink, spin, type,
        at: [assertFiniteNumber(at[0], `${field}.at[0]`), assertFiniteNumber(at[1], `${field}.at[1]`)],
        radius: assertPositiveWeight(value.radius, `${field}.radius`),
      };
    }
  }
}

function assertVariant(value: unknown, field: string): Variant {
  if (!isRecord(value)) throw new Error(`${field} must be an object`);
  const resolution = value.inks;
  if (
    resolution !== 'theme' && resolution !== 'light' &&
    resolution !== 'dark' && resolution !== 'black'
  ) {
    throw new Error(`${field}.inks must be one of ${INK_RESOLUTIONS.join(', ')}`);
  }
  const variant: Variant = {
    inks: resolution,
    scale: assertPositiveWeight(value.scale, `${field}.scale`),
  };
  if (value.field !== undefined) {
    if (!isRecord(value.field)) throw new Error(`${field}.field must be an object`);
    variant.field = {
      ink: assertString(value.field.ink, `${field}.field.ink`),
      radius: assertNonNegative(value.field.radius, `${field}.field.radius`),
    };
  }
  return variant;
}

/**
 * Every colour and number is validated before anything is derived or
 * written. These raw values are template-interpolated *unescaped* into SVG
 * and HTML attributes downstream (`generate/render.ts` writes `stroke="…"` and
 * `fill="…"`; `generate/head.ts` writes `color="…"` and `content="…"`) — and,
 * for element `id`, into a third sink with different escaping rules again: a
 * CSS custom-property *name* in `apps/web/src/components/shell/brand-mark.tsx`
 * (`--brand-${element.id}`). So an unvalidated field is not just a crash risk
 * — an unchecked ink colour could break out of an attribute and persist
 * chosen markup into the repo's real, hand-maintained `apps/web/index.html`,
 * and an unchecked id could inject chosen CSS into apps/web's bundled
 * stylesheet. Anchoring the hex pattern at both ends also rejects 3-digit
 * shorthand, `rgb()`, and named colours: the generators and the written
 * `icons.config.json` all assume 6-digit hex. `id` is anchored to a safe
 * charset for the same reason (see `assertElementId`).
 */
function assertIconDoc(value: unknown, field: string): IconDoc {
  if (!isRecord(value)) throw new Error(`${field} must be an object`);
  if (!isRecord(value.inks)) throw new Error(`${field}.inks must be an object`);
  if (!Array.isArray(value.elements)) throw new Error(`${field}.elements must be an array`);
  if (!isRecord(value.variants)) throw new Error(`${field}.variants must be an object`);

  // A plain `{}` accumulator is unsafe here: `Object.entries(value.inks)`
  // can legitimately yield a pair named `__proto__` (a JSON body decodes it
  // as an ordinary own key — JSON.parse uses CreateDataProperty, not
  // assignment), but writing it back with `inks[name] = ...` on a *plain*
  // object *is* assignment, and a bracket-assignment named `__proto__` hits
  // the inherited `Object.prototype.__proto__` accessor instead of creating
  // an own key: it silently replaces `inks`'s own prototype with the ink
  // object rather than adding an entry. The two written outputs then
  // disagree about that one ink's existence: `JSON.stringify(inks)` (which
  // walks own keys) omits it entirely, while a later `inks[id]` *read* (as
  // `resolveInk`, called from `chipFieldColor`/`leadColor` below, does)
  // resolves it through the hijacked prototype chain and finds it anyway.
  // `Object.create(null)` has no
  // inherited `__proto__` accessor to hit, so a name of `__proto__` becomes
  // an ordinary own key like any other — both paths agree. Same reasoning
  // for `variants` just below.
  const inks: Record<string, Ink> = Object.create(null);
  for (const [name, ink] of Object.entries(value.inks)) {
    inks[name] = assertInk(ink, `${field}.inks.${name}`);
  }
  const variants: Record<string, Variant> = Object.create(null);
  for (const [name, variant] of Object.entries(value.variants)) {
    variants[name] = assertVariant(variant, `${field}.variants.${name}`);
  }
  return {
    inks,
    elements: value.elements.map((e, i) => assertElement(e, `${field}.elements[${i}]`)),
    variants,
    motion: assertMotion(value.motion, `${field}.motion`),
  };
}

function assertRequest(body: unknown): GenerateRequest {
  if (typeof body !== 'object' || body === null) throw new Error('body must be an object');
  const { config, pngs } = body as { config?: unknown; pngs?: unknown };
  return { config: assertIconDoc(config, 'body.config'), pngs: assertPngs(pngs, 'body.pngs') };
}

/**
 * The chip field's resolved colour — what the manifest and the head block's
 * theme-color both share. Falls back to black rather than throwing when the
 * document has no `chip` variant or its field names an undefined ink:
 * `assertIconDoc` already decided this document is acceptable, so this must
 * degrade gracefully rather than reject a second time.
 */
function chipFieldColor(doc: IconDoc): string {
  const field = doc.variants.chip?.field;
  return field ? resolveInk(doc, field.ink, 'dark').dark : '#000000';
}

/**
 * The mask-icon colour: the light-theme ink of the *leading* element —
 * `doc.elements[0]`, whichever type it is. This replaces the retired
 * interim bridge's stick-only lookup, which degraded to black for any
 * document whose first element wasn't a stick (or had fewer than three
 * sticks at all) even though the document was perfectly valid — the mark
 * simply isn't drawn from sticks alone any more.
 */
function leadColor(doc: IconDoc): string {
  const lead = doc.elements[0];
  return lead ? resolveInk(doc, lead.ink, 'light').light : '#000000';
}

export async function runGenerate(body: unknown, repoRoot: string): Promise<GenerateResponse> {
  const { config: doc, pngs } = assertRequest(body);
  const results: GenerateResult[] = [];
  const rel = (abs: string) => path.relative(repoRoot, abs).split(path.sep).join('/');
  const themeColor = chipFieldColor(doc);

  // Everything derivable is derived here, not trusted from the client.
  const derived: Record<string, Buffer> = {
    'favicon.svg': Buffer.from(renderSvg(doc, 'favicon'), 'utf8'),
    'icon-mono.svg': Buffer.from(renderSvg(doc, 'mono'), 'utf8'),
    'site.webmanifest': Buffer.from(buildManifest(themeColor), 'utf8'),
    'icons.config.json': Buffer.from(JSON.stringify(doc, null, 2) + '\n', 'utf8'),
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
    const merged = injectHeadBlock(
      html,
      buildHeadBlock({ maskIconColor: leadColor(doc), themeColor }),
    );
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
