import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
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

test('a second identical run reports everything unchanged', async () => {
  const root = await fakeRepo();
  await runGenerate(body(), root);
  const { results } = await runGenerate(body(), root);
  expect(results.every((r) => r.status === 'unchanged')).toBe(true);
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
