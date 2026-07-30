import { BARE_REACH, DEFAULT_CONFIG, PRESETS, RATIO } from './config';

test('default config matches the locked design values', () => {
  expect(DEFAULT_CONFIG).toEqual({
    light: ['#7167ff', '#00bb9a', '#ff298a'],
    dark: ['#6652ff', '#12b898', '#ff378c'],
    chip: '#1b1830',
    angles: [62, 27, 160],
    bareWeight: 6,
    chipReach: 14,
    chipWeight: 4.6,
    // The spec's loader values: 120°/s top speed on a 0.9s smootherstep ramp,
    // resting on the logo pose so an idle loader is the favicon.
    motion: { speed: 120, restSpread: 8, ramp: 0.9, restPose: 'logo' },
  });
});

test('the bare mark holds the 1/3 weight-to-reach ratio', () => {
  expect(DEFAULT_CONFIG.bareWeight / BARE_REACH).toBeCloseTo(RATIO, 5);
});

test('the chip holds the same ratio', () => {
  // chipWeight is committed to one decimal place — a paintable stroke width —
  // so it cannot equal chipReach * RATIO (14 * 1/3 = 4.6667) exactly. 4.6,
  // not 4.7, is what got locked when the design rounded that value down to
  // one decimal. Assert the real relationship (chipWeight against
  // chipReach * RATIO, in stroke-width units) with a tolerance that names
  // its own budget, rather than `toBeCloseTo(RATIO, 2)` on the ratio itself:
  // that compared numbers 0.00476 apart against a 0.005 threshold, so a
  // single extra digit of drift in either value would have passed silently.
  // 0.1 is comfortably above the current 0.0667 gap (real headroom) while
  // still well below what a genuine mismatch between chipWeight and
  // chipReach would produce.
  const CHIP_WEIGHT_TOLERANCE = 0.1;
  const expectedChipWeight = DEFAULT_CONFIG.chipReach * RATIO;
  expect(Math.abs(DEFAULT_CONFIG.chipWeight - expectedChipWeight)).toBeLessThan(CHIP_WEIGHT_TOLERANCE);
});

test('every preset supplies three light, three dark and a chip', () => {
  for (const [name, p] of Object.entries(PRESETS)) {
    expect(p.light, name).toHaveLength(3);
    expect(p.dark, name).toHaveLength(3);
    expect(p.chip, name).toMatch(/^#[0-9a-f]{6}$/);
  }
});

test('the lifted preset only changes the dark violet', () => {
  expect(PRESETS.lifted.light).toEqual(PRESETS.chosen.light);
  expect(PRESETS.lifted.dark[0]).toBe('#8071ff');
  expect(PRESETS.lifted.dark.slice(1)).toEqual(PRESETS.chosen.dark.slice(1));
});
