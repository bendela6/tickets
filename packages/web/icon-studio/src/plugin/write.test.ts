import { mkdtemp, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DEFAULT_CONFIG } from '../config';
import { HEAD_START } from '../generate/head';
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

const body = () => ({
  config: DEFAULT_CONFIG,
  pngs: { 'icon-192.png': png, 'icon-512.png': png, 'apple-touch-icon.png': png },
});

test('writes all seven outputs and creates public/', async () => {
  const root = await fakeRepo();
  const { results } = await runGenerate(body(), root);

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

test('derives the svgs and manifest from the config rather than the client', async () => {
  const root = await fakeRepo();
  await runGenerate(body(), root);

  const favicon = await readFile(path.join(root, 'apps/web/public/favicon.svg'), 'utf8');
  expect(favicon).toContain(DEFAULT_CONFIG.light[0]);
  expect(favicon).toContain('prefers-color-scheme:dark');

  const manifest = JSON.parse(await readFile(path.join(root, 'apps/web/public/site.webmanifest'), 'utf8'));
  expect(manifest.theme_color).toBe(DEFAULT_CONFIG.chip);
});

test('round-trips the config so the studio reopens on it', async () => {
  const root = await fakeRepo();
  await runGenerate(body(), root);
  const saved = JSON.parse(await readFile(path.join(root, 'apps/web/icons.config.json'), 'utf8'));
  expect(saved).toEqual(DEFAULT_CONFIG);
});

test('injects the head block into index.html without touching the rest', async () => {
  const root = await fakeRepo();
  await runGenerate(body(), root);
  const html = await readFile(path.join(root, 'apps/web/index.html'), 'utf8');
  expect(html).toContain(HEAD_START);
  expect(html).toContain('<title>tickets</title>');
});

test('a second identical run reports everything unchanged and touches no file', async () => {
  const root = await fakeRepo();
  const { results: first } = await runGenerate(body(), root);

  // Prove no write happened, not just that the status string says so: an
  // implementation that fabricated 'unchanged' would still pass a check of
  // the status alone. temp-then-rename means a real write always produces a
  // new file identity (a fresh inode/file-id from the rename), so comparing
  // `ino` catches a disguised write even if it landed within the same
  // millisecond as the first run — an mtime comparison alone could alias
  // that on a coarse clock, `ino` cannot.
  const inoOf = async (rel: string) => (await stat(path.join(root, rel))).ino;
  const before = await Promise.all(first.map((r) => inoOf(r.path)));

  const { results: second } = await runGenerate(body(), root);
  expect(second.every((r) => r.status === 'unchanged')).toBe(true);

  const after = await Promise.all(first.map((r) => inoOf(r.path)));
  expect(after).toEqual(before);
});

test('rejects an unknown png name and writes nothing for it', async () => {
  const root = await fakeRepo();
  const { results } = await runGenerate(
    { config: DEFAULT_CONFIG, pngs: { 'evil.png': png } },
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
      config: DEFAULT_CONFIG,
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

test('rejects a non-hex colour in light', async () => {
  const root = await fakeRepo();
  const bad = {
    ...DEFAULT_CONFIG,
    light: ['not-a-colour', DEFAULT_CONFIG.light[1], DEFAULT_CONFIG.light[2]],
  };
  await expect(runGenerate({ config: bad, pngs: {} }, root)).rejects.toThrow(/light\[0\]/);
});

test('rejects a non-hex chip colour (3-digit shorthand) before writing anything', async () => {
  const root = await fakeRepo();
  const bad = { ...DEFAULT_CONFIG, chip: '#fff' };
  await expect(runGenerate({ config: bad, pngs: {} }, root)).rejects.toThrow(/chip/);

  // The whole point of validating up front: a rejected config must not have
  // touched the repo's hand-maintained index.html on the way to failing.
  const html = await readFile(path.join(root, 'apps/web/index.html'), 'utf8');
  expect(html).toBe(INDEX);
});

test('rejects a non-finite angle', async () => {
  const root = await fakeRepo();
  const bad = {
    ...DEFAULT_CONFIG,
    angles: [DEFAULT_CONFIG.angles[0], Number.NaN, DEFAULT_CONFIG.angles[2]],
  };
  await expect(runGenerate({ config: bad, pngs: {} }, root)).rejects.toThrow(/angles\[1\]/);
});

test('rejects a zero or negative weight', async () => {
  const root = await fakeRepo();
  const zero = { ...DEFAULT_CONFIG, bareWeight: 0 };
  await expect(runGenerate({ config: zero, pngs: {} }, root)).rejects.toThrow(/bareWeight/);

  const negative = { ...DEFAULT_CONFIG, chipReach: -1 };
  await expect(runGenerate({ config: negative, pngs: {} }, root)).rejects.toThrow(/chipReach/);
});

test('accepts a fully valid config unchanged, so the guard is not over-tight', async () => {
  const root = await fakeRepo();
  const valid = {
    light: ['#123456', '#abcdef', '#000000'],
    dark: ['#654321', '#fedcba', '#ffffff'],
    chip: '#010203',
    angles: [0, 180.5, -45],
    bareWeight: 0.5,
    chipReach: 1,
    chipWeight: 0.1,
  };
  const { results } = await runGenerate({ config: valid, pngs: {} }, root);
  expect(results.filter((r) => r.status === 'rejected')).toEqual([]);
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

  const { results } = await runGenerate(body(), root);

  const indexResult = results.find((r) => r.path === 'apps/web/index.html');
  expect(indexResult?.status).toBe('rejected');
  expect(indexResult?.reason).toMatch(/marker/i);

  const others = results.filter((r) => r.path !== 'apps/web/index.html');
  expect(others.length).toBeGreaterThan(0);
  expect(others.every((r) => r.status === 'written')).toBe(true);
});
