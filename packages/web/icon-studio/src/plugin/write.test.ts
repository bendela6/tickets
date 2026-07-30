import { mkdtemp, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DEFAULT_DOC } from '../doc';
import { HEAD_START } from '../generate/head';
import { toDoc } from '../migrate';
import { studioReducer, type StudioState } from '../state';
import { runGenerate } from './write';

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const png = Buffer.concat([PNG_SIG, Buffer.alloc(16)]).toString('base64');

const INDEX = `<!doctype html>
<html lang="en">
  <head>
    <title>tickets</title>
  </head>
  <body></body>
</html>
`;

async function fakeRepo() {
  const root = await mkdtemp(path.join(tmpdir(), 'icon-studio-'));
  await mkdir(path.join(root, 'apps', 'web'), { recursive: true });
  await writeFile(path.join(root, 'apps', 'web', 'index.html'), INDEX, 'utf8');
  return root;
}

const docBody = () => ({
  config: DEFAULT_DOC,
  pngs: { 'icon-192.png': png, 'icon-512.png': png, 'apple-touch-icon.png': png },
});

/** `DEFAULT_DOC.inks` is a `Record`, so a known key still reads as possibly `undefined`. */
function ink(name: string, theme: 'light' | 'dark'): string {
  const value = DEFAULT_DOC.inks[name]?.[theme];
  if (value === undefined) throw new Error(`DEFAULT_DOC.inks.${name}.${theme} is missing`);
  return value;
}

test('writes all seven outputs and creates public/', async () => {
  const root = await fakeRepo();
  const { results } = await runGenerate(docBody(), root);

  expect(results.filter((r) => r.status === 'rejected')).toEqual([]);
  expect(results.map((r) => r.path).sort()).toEqual([
    'apps/web/icons.config.json',
    'apps/web/index.html',
    'apps/web/public/apple-touch-icon.png',
    'apps/web/public/favicon.svg',
    'apps/web/public/icon-192.png',
    'apps/web/public/icon-512.png',
    'apps/web/public/icon-mono.svg',
    'apps/web/public/site.webmanifest',
  ]);
});

test('writes every output from a document', async () => {
  const root = await fakeRepo();
  const { results } = await runGenerate(docBody(), root);
  expect(results.filter((r) => r.status === 'rejected')).toEqual([]);
});

test('derives the svgs and manifest from the document rather than the client', async () => {
  const root = await fakeRepo();
  await runGenerate(docBody(), root);

  const favicon = await readFile(path.join(root, 'apps/web/public/favicon.svg'), 'utf8');
  expect(favicon).toContain(ink('top', 'light'));
  expect(favicon).toContain('prefers-color-scheme:dark');

  const manifest = JSON.parse(await readFile(path.join(root, 'apps/web/public/site.webmanifest'), 'utf8'));
  expect(manifest.theme_color).toBe(ink('field', 'dark'));
});

test('round-trips the document so the studio reopens on it', async () => {
  const root = await fakeRepo();
  await runGenerate(docBody(), root);
  const saved = JSON.parse(await readFile(path.join(root, 'apps/web/icons.config.json'), 'utf8'));
  expect(saved).toEqual(DEFAULT_DOC);
});

test('injects the head block into index.html without touching the rest', async () => {
  const root = await fakeRepo();
  await runGenerate(docBody(), root);
  const html = await readFile(path.join(root, 'apps/web/index.html'), 'utf8');
  expect(html).toContain(HEAD_START);
  expect(html).toContain('<title>tickets</title>');
});

test('a second identical run reports everything unchanged and touches no file', async () => {
  const root = await fakeRepo();
  const { results: first } = await runGenerate(docBody(), root);

  // Prove no write happened, not just that the status string says so: an
  // implementation that fabricated 'unchanged' would still pass a check of
  // the status alone. temp-then-rename means a real write always produces a
  // new file identity (a fresh inode/file-id from the rename), so comparing
  // `ino` catches a disguised write even if it landed within the same
  // millisecond as the first run — an mtime comparison alone could alias
  // that on a coarse clock, `ino` cannot.
  const inoOf = async (rel: string) => (await stat(path.join(root, rel))).ino;
  const before = await Promise.all(first.map((r) => inoOf(r.path)));

  const { results: second } = await runGenerate(docBody(), root);
  expect(second.every((r) => r.status === 'unchanged')).toBe(true);

  const after = await Promise.all(first.map((r) => inoOf(r.path)));
  expect(after).toEqual(before);
});

test('rejects an unknown png name and writes nothing for it', async () => {
  const root = await fakeRepo();
  const { results } = await runGenerate(
    { config: DEFAULT_DOC, pngs: { 'evil.png': png } },
    root,
  );
  const evil = results.find((r) => r.path === 'evil.png');
  expect(evil?.status).toBe('rejected');
  expect(evil?.reason).toMatch(/not an allowed output/);
});

test('rejects a png payload that is not a png', async () => {
  const root = await fakeRepo();
  const { results } = await runGenerate(
    {
      config: DEFAULT_DOC,
      pngs: { 'icon-192.png': Buffer.from('<svg/>').toString('base64') },
    },
    root,
  );
  const bad = results.find((r) => r.path.endsWith('icon-192.png'));
  expect(bad?.status).toBe('rejected');
  expect(bad?.reason).toBe('not a png');
});

test('rejects a malformed body without throwing', async () => {
  const root = await fakeRepo();
  await expect(runGenerate({ nope: true }, root)).rejects.toThrow(/config/);
});

test('rejects a non-string png payload before writing anything, rather than crashing inside decodePng', async () => {
  const root = await fakeRepo();
  // A non-string value (e.g. `{"icon-192.png": 123}`) would otherwise reach
  // `decodePng`, which calls `.replace` on it and throws a raw
  // "payload.replace is not a function" — after the derived outputs had
  // already been written. Rejecting it in assertRequest keeps the whole
  // request from writing anything at all.
  await expect(
    runGenerate({ config: DEFAULT_DOC, pngs: { 'icon-192.png': 123 } }, root),
  ).rejects.toThrow(/body\.pngs/);

  const entries = await readdir(path.join(root, 'apps', 'web'));
  expect(entries).toEqual(['index.html']);
});

test.each([
  ['no elements array', { ...DEFAULT_DOC, elements: undefined }, 'body.config.elements must be an array'],
  ['an unknown element type', { ...DEFAULT_DOC, elements: [{ id: 'a', type: 'blob', ink: 'top' }] },
    'body.config.elements[0].type must be one of stick, ring, dot'],
  ['an element naming no ink', { ...DEFAULT_DOC, elements: [{ id: 'a', type: 'ring', radius: 5, weight: 1 }] },
    'body.config.elements[0].ink must be a string'],
  ['a bad ink colour', { ...DEFAULT_DOC, inks: { top: { light: 'red', dark: '#000000' } } },
    'body.config.inks.top.light must be a 6-digit hex color'],
  // The hex regex is anchored on digit count, not just "starts with # and is
  // stringy" — 'red' above proves the latter; this proves 3-digit shorthand
  // (valid CSS, invalid here) is rejected too, so loosening `{6}` to `{3,6}`
  // would be caught.
  ['a 3-digit hex shorthand ink colour', { ...DEFAULT_DOC, inks: { top: { light: '#fff', dark: '#000000' } } },
    'body.config.inks.top.light must be a 6-digit hex color'],
  ['an element id containing a space', {
    ...DEFAULT_DOC,
    elements: [{ id: 'top mid', type: 'stick', ink: 'top', angle: 0, reach: 10, weight: 2 }],
  }, 'body.config.elements[0].id must contain only letters, digits, hyphens and underscores'],
  // The concrete sink this guards: `apps/web/src/components/shell/brand-mark.tsx`
  // interpolates `id` straight into a CSS custom-property name
  // (`--brand-${id}`) — a `}` there closes the declaration and lets the rest
  // of the id inject further CSS into apps/web's bundle.
  ['an element id containing a CSS-breaking character', {
    ...DEFAULT_DOC,
    elements: [{ id: 'x}injected{y', type: 'stick', ink: 'top', angle: 0, reach: 10, weight: 2 }],
  }, 'body.config.elements[0].id must contain only letters, digits, hyphens and underscores'],
  ['an unknown ink resolution', { ...DEFAULT_DOC, variants: { v: { inks: 'sepia', scale: 1 } } },
    'body.config.variants.v.inks must be one of theme, light, dark, black'],
  ['a zero scale', { ...DEFAULT_DOC, variants: { v: { inks: 'dark', scale: 0 } } },
    'body.config.variants.v.scale must be a finite number greater than zero'],
])('rejects a document with %s, and writes nothing', async (_label, config, message) => {
  const root = await fakeRepo();
  await expect(runGenerate({ ...docBody(), config }, root)).rejects.toThrow(message);
  await expect(stat(path.join(root, 'apps', 'web', 'public'))).rejects.toThrow();
});

// Each case below pins one specific `assertFiniteNumber`/`assertPositiveWeight`
// call site inside `assertElement` — the shared helpers are already exercised
// (via `Variant.scale` above and via `assertMotion`'s own tests), which proves
// the *helpers* work but not that every element branch still calls them. A
// `DEFAULT_DOC`-only suite can't catch a dropped call here, since every one of
// its values is already valid.
test.each([
  ['a non-finite stick angle',
    [{ id: 'a', type: 'stick', ink: 'top', angle: Number.NaN, reach: 10, weight: 2 }],
    'body.config.elements[0].angle must be a finite number'],
  ['a zero stick reach',
    [{ id: 'a', type: 'stick', ink: 'top', angle: 0, reach: 0, weight: 2 }],
    'body.config.elements[0].reach must be a finite number greater than zero'],
  ['a negative stick weight',
    [{ id: 'a', type: 'stick', ink: 'top', angle: 0, reach: 10, weight: -1 }],
    'body.config.elements[0].weight must be a finite number greater than zero'],
  ['a zero ring radius',
    [{ id: 'a', type: 'ring', ink: 'top', radius: 0, weight: 2 }],
    'body.config.elements[0].radius must be a finite number greater than zero'],
  ['a negative ring weight',
    [{ id: 'a', type: 'ring', ink: 'top', radius: 5, weight: -2 }],
    'body.config.elements[0].weight must be a finite number greater than zero'],
  ['a zero dot radius',
    [{ id: 'a', type: 'dot', ink: 'top', at: [4, 4], radius: 0 }],
    'body.config.elements[0].radius must be a finite number greater than zero'],
])('rejects an element with %s, and writes nothing', async (_label, elements, message) => {
  const root = await fakeRepo();
  const config = { ...DEFAULT_DOC, elements };
  await expect(runGenerate({ ...docBody(), config }, root)).rejects.toThrow(message);
  await expect(stat(path.join(root, 'apps', 'web', 'public'))).rejects.toThrow();
});

test('accepts a document with zero elements', async () => {
  // An empty icon is a legitimate starting point, not an error.
  const root = await fakeRepo();
  const config = { ...DEFAULT_DOC, elements: [] };
  const { results } = await runGenerate({ ...docBody(), config }, root);
  expect(results.filter((r) => r.status === 'rejected')).toEqual([]);
});

test('an ink or variant literally named "__proto__" round-trips as an own key, not a hijacked prototype', async () => {
  const root = await fakeRepo();
  // Built from a literal JSON string, not an object literal: `{ __proto__:
  // x }` as *object-literal syntax* is special-cased by the language itself
  // to set the new object's prototype rather than create an own property, so
  // a JS literal here wouldn't even reach assertIconDoc with the hazard
  // intact. `JSON.parse`, by contrast, always creates a genuine own
  // property no matter the key's name (it uses CreateDataProperty, never
  // assignment) — this is exactly what `icon-writer.ts` hands to
  // `runGenerate` after parsing a real request body, so this is the actual
  // attack surface, not a synthetic one.
  const malicious = JSON.parse(`{
    "inks": { "__proto__": { "light": "#123456", "dark": "#abcdef" } },
    "elements": [
      { "id": "a", "type": "stick", "ink": "__proto__", "angle": 0, "reach": 10, "weight": 5 }
    ],
    "variants": {
      "__proto__": { "inks": "dark", "scale": 1 },
      "favicon": { "inks": "theme", "scale": 1 },
      "mono": { "inks": "black", "scale": 1 }
    },
    "motion": ${JSON.stringify(DEFAULT_DOC.motion)}
  }`);

  const { results } = await runGenerate({ ...docBody(), config: malicious }, root);
  expect(results.filter((r) => r.status === 'rejected')).toEqual([]);

  const saved = JSON.parse(await readFile(path.join(root, 'apps/web/icons.config.json'), 'utf8'));
  // The failure mode this guards against: a hijacked-prototype `inks` would
  // make `saved.inks.__proto__` resolve through inheritance to *something*
  // even if nothing was ever actually stored — only `hasOwnProperty` proves
  // an own key genuinely round-tripped.
  expect(Object.prototype.hasOwnProperty.call(saved.inks, '__proto__')).toBe(true);
  expect(saved.inks.__proto__).toEqual({ light: '#123456', dark: '#abcdef' });
  expect(Object.prototype.hasOwnProperty.call(saved.variants, '__proto__')).toBe(true);

  // The two written files must agree, not merely both "not crash": the
  // favicon's colour for the "__proto__"-inked stick has to be the exact
  // colour icons.config.json claims to hold for that same ink.
  const favicon = await readFile(path.join(root, 'apps/web/public/favicon.svg'), 'utf8');
  expect(favicon).toContain('#123456');
});

// Task 7 retired the interim MarkConfig-bridging helper this file used to
// call here, which only ever read stick-type elements — a document led by a
// ring or a dot (or with fewer than three sticks) silently degraded to black
// there, even though the document itself was perfectly valid. The two tests
// below prove the replacement (`leadColor`/`chipFieldColor` in write.ts, both
// built on `resolveInk`) no longer has that blind spot.

test('the head mask-icon colour comes from the leading element regardless of its type', async () => {
  const root = await fakeRepo();
  const config = {
    ...DEFAULT_DOC,
    // A ring leads the document — under the old bridge this would have
    // fallen straight to black, since only stick-type elements were read.
    elements: [
      { id: 'r', type: 'ring', ink: 'top', radius: 10, weight: 3 },
      { id: 's', type: 'stick', ink: 'mid', angle: 45, reach: 12, weight: 5 },
    ],
  };

  const { results } = await runGenerate({ ...docBody(), config }, root);
  expect(results.filter((r) => r.status === 'rejected')).toEqual([]);

  const html = await readFile(path.join(root, 'apps/web/index.html'), 'utf8');
  expect(html).toContain(`color="${ink('top', 'light')}"`);
});

test('the manifest and head theme colour come from the chip variant field ink, not a placeholder', async () => {
  const root = await fakeRepo();
  const config = {
    ...DEFAULT_DOC,
    elements: [{ id: 'r', type: 'ring', ink: 'low', radius: 10, weight: 3 }],
  };

  const { results } = await runGenerate({ ...docBody(), config }, root);
  expect(results.filter((r) => r.status === 'rejected')).toEqual([]);

  const manifest = JSON.parse(
    await readFile(path.join(root, 'apps/web/public/site.webmanifest'), 'utf8'),
  );
  expect(manifest.theme_color).toBe(ink('field', 'dark'));

  const html = await readFile(path.join(root, 'apps/web/index.html'), 'utf8');
  expect(html).toContain(`content="${ink('field', 'dark')}"`);
});

test('a malformed head marker rejects only the index.html step; every other output still writes', async () => {
  const root = await fakeRepo();
  // Only HEAD_START is present — a stale, hand-edited marker pairing that
  // injectHeadBlock refuses to guess its way through.
  const malformed = `<!doctype html>
<html lang="en">
  <head>
    ${HEAD_START}
    <title>tickets</title>
  </head>
  <body></body>
</html>
`;
  await writeFile(path.join(root, 'apps', 'web', 'index.html'), malformed, 'utf8');

  const { results } = await runGenerate(docBody(), root);

  const indexResult = results.find((r) => r.path === 'apps/web/index.html');
  expect(indexResult?.status).toBe('rejected');
  expect(indexResult?.reason).toMatch(/marker/i);

  const others = results.filter((r) => r.path !== 'apps/web/index.html');
  expect(others.length).toBeGreaterThan(0);
  expect(others.every((r) => r.status === 'written')).toBe(true);
});

test('persists the motion block into icons.config.json', async () => {
  const root = await fakeRepo();
  const tuned = {
    ...DEFAULT_DOC,
    motion: { speed: 260, restSpread: 24, ramp: 0.4, restPose: 'fan' as const },
  };

  await runGenerate({ ...docBody(), config: tuned }, root);
  const saved = JSON.parse(
    await readFile(path.join(root, 'apps', 'web', 'icons.config.json'), 'utf8'),
  );

  expect(saved.motion).toEqual(tuned.motion);
});

// Generate writes the validated document straight back over icons.config.json, so
// a missing or malformed motion block must be a loud rejection — substituting
// defaults would silently overwrite tuned values and report a normal write.
test.each([
  ['missing entirely', undefined, 'body.config.motion must be an object'],
  ['an array', [120, 8], 'body.config.motion must be an object'],
  ['an unknown rest pose', { speed: 120, restSpread: 8, ramp: 0.9, restPose: 'spiral' },
    'body.config.motion.restPose must be "logo" or "fan"'],
  ['a zero speed', { speed: 0, restSpread: 8, ramp: 0.9, restPose: 'logo' },
    'body.config.motion.speed must be a finite number greater than zero'],
  ['a negative ramp', { speed: 120, restSpread: 8, ramp: -1, restPose: 'logo' },
    'body.config.motion.ramp must not be negative'],
  ['a non-numeric spread', { speed: 120, restSpread: '8', ramp: 0.9, restPose: 'logo' },
    'body.config.motion.restSpread must be a finite number'],
])('rejects motion that is %s, and writes nothing', async (_label, motion, message) => {
  const root = await fakeRepo();
  const config = { ...DEFAULT_DOC, motion } as typeof DEFAULT_DOC;

  await expect(runGenerate({ ...docBody(), config }, root)).rejects.toThrow(message);
  // The rejection has to land before any file is derived or written.
  await expect(stat(path.join(root, 'apps', 'web', 'public'))).rejects.toThrow();
  await expect(stat(path.join(root, 'apps', 'web', 'icons.config.json'))).rejects.toThrow();
});

test('accepts a zero ramp and a fully stacked rest pose', async () => {
  // Both are legitimate: an instant ramp, and every stick starting aligned.
  const root = await fakeRepo();
  const config = {
    ...DEFAULT_DOC,
    motion: { speed: 90, restSpread: 0, ramp: 0, restPose: 'fan' as const },
  };

  const { results } = await runGenerate({ ...docBody(), config }, root);
  expect(results.filter((r) => r.status === 'rejected')).toEqual([]);
});

// A non-spinning element's `spin` used to be serialised as `undefined`
// (`value.spin === true ? true : undefined`), which `JSON.stringify` then
// drops from the written `icons.config.json` entirely. On reopen, `toDoc`'s
// pass-through branch leaves that element with no `spin` key at all, and
// `studioReducer`'s `updateElement` guard (state.ts) only ever applies a
// patch key already present on the target element — so a later attempt to
// turn spin back on would dispatch a patch the guard silently drops. The
// bug needs an element with `spin: false` to reproduce: `DEFAULT_DOC`'s
// elements are all `spin: true`, which is exactly why the existing
// "round-trips the document" test above (built on `docBody()`) never caught
// it.
test('spin survives a round trip even when false, so the toggle is not a permanent no-op', async () => {
  const root = await fakeRepo();
  const config = {
    ...DEFAULT_DOC,
    elements: [{ id: 'r', type: 'ring' as const, ink: 'top', spin: false, radius: 10, weight: 3 }],
  };

  await runGenerate({ ...docBody(), config }, root);
  const saved = JSON.parse(await readFile(path.join(root, 'apps/web/icons.config.json'), 'utf8'));

  // Must be an own, *present* key — not merely absent-and-therefore-reading-
  // as-falsy. `saved.elements[0].spin === false` alone would also pass for a
  // dropped key (reading a missing property yields `undefined`, which is
  // also falsy); `hasOwnProperty` is what actually distinguishes "false" from
  // "not there".
  expect(Object.prototype.hasOwnProperty.call(saved.elements[0], 'spin')).toBe(true);
  expect(saved.elements[0].spin).toBe(false);

  // And prove the round-tripped document actually accepts a later spin
  // toggle — reopen exactly as the studio would (toDoc's pass-through
  // branch), then dispatch the same action the checkbox does.
  const reopened = toDoc(saved);
  const state: StudioState = { doc: reopened };
  const next = studioReducer(state, { type: 'updateElement', id: 'r', patch: { spin: true } });
  expect(next.doc.elements[0]?.spin).toBe(true);
});
