import { expect, test } from 'vitest';
import { BARE_REACH, CENTRE, DEFAULT_DOC, GRID } from './doc';

test('the grid is the 48-unit square the mark spec locks', () => {
  expect(GRID).toBe(48);
  expect(CENTRE).toBe(24);
  expect(BARE_REACH).toBe(18);
});

test('the default document is the locked mark: three spinning sticks on three inks', () => {
  expect(Object.keys(DEFAULT_DOC.inks).sort()).toEqual(['field', 'low', 'mid', 'top']);
  expect(DEFAULT_DOC.inks.top).toEqual({ light: '#7167ff', dark: '#6652ff' });
  expect(DEFAULT_DOC.inks.mid).toEqual({ light: '#00bb9a', dark: '#12b898' });
  expect(DEFAULT_DOC.inks.low).toEqual({ light: '#ff298a', dark: '#ff378c' });
  // The chip field is dark in both themes — a coloured field cannot knock out
  // three colours.
  expect(DEFAULT_DOC.inks.field).toEqual({ light: '#1b1830', dark: '#1b1830' });

  expect(DEFAULT_DOC.elements).toEqual([
    { id: 'top', type: 'stick', ink: 'top', spin: true, angle: 62, reach: 18, weight: 6 },
    { id: 'mid', type: 'stick', ink: 'mid', spin: true, angle: 27, reach: 18, weight: 6 },
    { id: 'low', type: 'stick', ink: 'low', spin: true, angle: 160, reach: 18, weight: 6 },
  ]);
});

test('the built-in variants reproduce the four renderings', () => {
  expect(DEFAULT_DOC.variants.favicon).toEqual({ inks: 'theme', scale: 1 });
  expect(DEFAULT_DOC.variants.mono).toEqual({ inks: 'black', scale: 1 });
  expect(DEFAULT_DOC.variants.chip).toEqual({
    inks: 'dark',
    scale: 14 / 18,
    field: { ink: 'field', radius: 11 },
  });
});

test('the motion block carries the spec values', () => {
  expect(DEFAULT_DOC.motion).toEqual({
    speed: 120,
    restSpread: 8,
    ramp: 0.9,
    restPose: 'logo',
  });
});
