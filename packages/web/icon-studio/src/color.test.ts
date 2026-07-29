import { adjust, contrast, GROUND, NEUTRAL, toHex, toHsl, verdict } from './color';

test('hsl round trip is lossless for the locked palette', () => {
  for (const hex of ['#7167ff', '#00bb9a', '#ff298a', '#6652ff', '#1b1830', '#ffffff', '#000000']) {
    const [h, s, l] = toHsl(hex);
    expect(toHex(h, s, l)).toBe(hex);
  }
});

test('a neutral adjustment returns the input unchanged', () => {
  for (const hex of ['#7167ff', '#00bb9a', '#ff298a']) {
    expect(adjust(hex, NEUTRAL)).toBe(hex);
  }
});

test('raising saturation and lightness moves the colour', () => {
  const out = adjust('#7167ff', { hue: 0, sat: 1.4, lit: 0.05 });
  expect(out).not.toBe('#7167ff');
  const [, s, l] = toHsl(out);
  const [, s0, l0] = toHsl('#7167ff');
  expect(l).toBeGreaterThan(l0);
  expect(s).toBeGreaterThanOrEqual(s0);
});

test('lightness is clamped so a colour never becomes pure black or white', () => {
  expect(adjust('#ffffff', { hue: 0, sat: 1, lit: 0.9 })).not.toBe('#ffffff');
  const [, , l] = toHsl(adjust('#000000', { hue: 0, sat: 1, lit: -0.9 }));
  expect(l).toBeGreaterThan(0);
});

test('contrast matches the measured values from the design', () => {
  expect(contrast('#7167ff', GROUND.light)).toBeCloseTo(4.13, 1);
  expect(contrast('#00bb9a', GROUND.light)).toBeCloseTo(2.45, 1);
  expect(contrast('#6652ff', GROUND.dark)).toBeCloseTo(2.42, 1);
  expect(contrast('#12b898', GROUND.dark)).toBeCloseTo(4.79, 1);
});

test('contrast is symmetric', () => {
  expect(contrast('#7167ff', '#ffffff')).toBeCloseTo(contrast('#ffffff', '#7167ff'), 6);
});

test('verdict bands split at 3 and 4.5', () => {
  expect(verdict(5)).toBe('ok');
  expect(verdict(4.5)).toBe('ok');
  expect(verdict(3.2)).toBe('min');
  expect(verdict(3)).toBe('min');
  expect(verdict(2.9)).toBe('bad');
});
