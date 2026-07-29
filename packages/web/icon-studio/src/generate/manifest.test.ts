import { DEFAULT_CONFIG } from '../config';
import { buildManifest } from './manifest';

test('manifest is pretty JSON ending in a newline', () => {
  const out = buildManifest(DEFAULT_CONFIG);
  expect(out.endsWith('\n')).toBe(true);
  expect(() => JSON.parse(out)).not.toThrow();
  expect(out).toContain('\n  "name"');
});

test('manifest declares a standalone app themed to the chip field', () => {
  const m = JSON.parse(buildManifest(DEFAULT_CONFIG));
  expect(m.name).toBe('tickets');
  expect(m.short_name).toBe('tickets');
  expect(m.start_url).toBe('/');
  expect(m.scope).toBe('/');
  expect(m.display).toBe('standalone');
  expect(m.theme_color).toBe(DEFAULT_CONFIG.chip);
  expect(m.background_color).toBe(DEFAULT_CONFIG.chip);
});

test('manifest lists both maskable icons', () => {
  const m = JSON.parse(buildManifest(DEFAULT_CONFIG));
  expect(m.icons).toHaveLength(2);
  expect(m.icons.map((i: { src: string }) => i.src)).toEqual(['/icon-192.png', '/icon-512.png']);
  for (const icon of m.icons) {
    expect(icon.type).toBe('image/png');
    expect(icon.purpose).toBe('maskable any');
  }
});
