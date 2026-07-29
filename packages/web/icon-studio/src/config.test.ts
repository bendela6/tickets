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
  });
});

test('the bare mark holds the 1/3 weight-to-reach ratio', () => {
  expect(DEFAULT_CONFIG.bareWeight / BARE_REACH).toBeCloseTo(RATIO, 5);
});

test('the chip holds the same ratio', () => {
  expect(DEFAULT_CONFIG.chipWeight / DEFAULT_CONFIG.chipReach).toBeCloseTo(RATIO, 2);
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
