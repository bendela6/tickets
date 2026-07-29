import { DEFAULT_CONFIG } from '../config';
import { outerExtent, safeZonePct, svgBare, svgChip, svgFavicon, svgMono } from './svg';

const all = () => ({
  favicon: svgFavicon(DEFAULT_CONFIG),
  bareLight: svgBare(DEFAULT_CONFIG, 'light'),
  bareDark: svgBare(DEFAULT_CONFIG, 'dark'),
  mono: svgMono(DEFAULT_CONFIG),
  chip: svgChip(DEFAULT_CONFIG),
  chipSquare: svgChip(DEFAULT_CONFIG, { rounded: false }),
});

test('every variant is one well-formed svg with exactly three sticks', () => {
  for (const [name, svg] of Object.entries(all())) {
    expect(svg.match(/<svg/g), name).toHaveLength(1);
    expect(svg.match(/<\/svg>/g), name).toHaveLength(1);
    expect(svg.match(/<path/g), name).toHaveLength(3);
    expect(svg, name).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg, name).toContain('viewBox="0 0 48 48"');
  }
});

test('every variant honours the configured angles', () => {
  const config = { ...DEFAULT_CONFIG, angles: [5, 37, 155] as [number, number, number] };
  for (const svg of [svgFavicon(config), svgBare(config, 'light'), svgMono(config), svgChip(config)]) {
    expect(svg).toContain('rotate(5 24 24)');
    expect(svg).toContain('rotate(37 24 24)');
    expect(svg).toContain('rotate(155 24 24)');
  }
});

test('sticks are painted back to front so `top` is on top', () => {
  const svg = svgBare(DEFAULT_CONFIG, 'light');
  const low = svg.indexOf(DEFAULT_CONFIG.light[2]);
  const mid = svg.indexOf(DEFAULT_CONFIG.light[1]);
  const top = svg.indexOf(DEFAULT_CONFIG.light[0]);
  expect(low).toBeLessThan(mid);
  expect(mid).toBeLessThan(top);
});

test('favicon inlines both triads and swaps them by colour scheme', () => {
  const svg = svgFavicon(DEFAULT_CONFIG);
  for (const hex of [...DEFAULT_CONFIG.light, ...DEFAULT_CONFIG.dark]) {
    expect(svg).toContain(hex);
  }
  expect(svg).toContain('prefers-color-scheme:dark');
});

test('bare variants carry only their own triad', () => {
  const light = svgBare(DEFAULT_CONFIG, 'light');
  expect(light).toContain(DEFAULT_CONFIG.light[0]);
  expect(light).not.toContain(DEFAULT_CONFIG.dark[0]);
});

test('mono is a single black colour with no palette hex', () => {
  const svg = svgMono(DEFAULT_CONFIG);
  expect(svg).toContain('#000');
  for (const hex of [...DEFAULT_CONFIG.light, ...DEFAULT_CONFIG.dark]) {
    expect(svg).not.toContain(hex);
  }
});

test('chip fills the field, uses the dark triad and insets the mark', () => {
  const svg = svgChip(DEFAULT_CONFIG);
  expect(svg).toContain(`fill="${DEFAULT_CONFIG.chip}"`);
  expect(svg).toContain(`stroke-width="${DEFAULT_CONFIG.chipWeight}"`);
  expect(svg).toContain(DEFAULT_CONFIG.dark[0]);
  // reach 14 -> the stick spans 24±14
  expect(svg).toContain('M24 10L24 38');
});

test('chip corners: rounded by default, square when asked', () => {
  expect(svgChip(DEFAULT_CONFIG)).toContain('rx="11"');
  expect(svgChip(DEFAULT_CONFIG, { rounded: false })).toContain('rx="0"');
});

test('the chip mark sits inside the android safe circle', () => {
  expect(outerExtent(DEFAULT_CONFIG)).toBeCloseTo(16.3, 1);
  expect(safeZonePct(DEFAULT_CONFIG)).toBeCloseTo(68, 0);
  expect(safeZonePct(DEFAULT_CONFIG)).toBeLessThan(80);
});
