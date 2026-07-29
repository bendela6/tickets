import path from 'node:path';
import { OUTPUTS, PNG_NAMES, resolveOutput } from './outputs';

const ROOT = path.resolve('/repo');

test('every known name resolves inside the repo root', () => {
  for (const name of Object.keys(OUTPUTS)) {
    const abs = resolveOutput(name, ROOT);
    expect(abs, name).not.toBeNull();
    expect(abs!.startsWith(ROOT + path.sep), name).toBe(true);
  }
});

test('the three rasterised names are the only ones the client supplies', () => {
  expect([...PNG_NAMES]).toEqual(['icon-192.png', 'icon-512.png', 'apple-touch-icon.png']);
  for (const name of PNG_NAMES) expect(OUTPUTS).toHaveProperty(name);
});

test('unknown names are refused', () => {
  for (const name of ['evil.png', 'favicon.SVG', '', 'icon-193.png']) {
    expect(resolveOutput(name, ROOT), name).toBeNull();
  }
});

test('traversal attempts are refused because the name is never a path', () => {
  for (const name of ['../../etc/passwd', '..\\..\\windows\\system32', '/etc/passwd', 'a/b.png']) {
    expect(resolveOutput(name, ROOT), name).toBeNull();
  }
});

test('the table covers exactly the six assets plus the config', () => {
  expect(Object.keys(OUTPUTS).sort()).toEqual([
    'apple-touch-icon.png',
    'favicon.svg',
    'icon-192.png',
    'icon-512.png',
    'icon-mono.svg',
    'icons.config.json',
    'site.webmanifest',
  ]);
});
