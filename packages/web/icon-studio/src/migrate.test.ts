import { expect, test } from 'vitest';
import { BARE_REACH, DEFAULT_DOC } from './doc';
import { toDoc } from './migrate';

const OLD = {
  light: ['#7167ff', '#00bb9a', '#ff298a'],
  dark: ['#6652ff', '#12b898', '#ff378c'],
  chip: '#1b1830',
  angles: [62, 27, 160],
  bareWeight: 6,
  chipReach: 14,
  chipWeight: 4.6,
  motion: { speed: 120, restSpread: 8, ramp: 0.9, restPose: 'logo' },
};

test('the locked old config migrates to the default document', () => {
  expect(toDoc(OLD)).toEqual(DEFAULT_DOC);
});

test('angles and weight become one stick element each, in painted order', () => {
  const doc = toDoc({ ...OLD, angles: [10, 55, 100], bareWeight: 8 });

  expect(doc.elements.map((e) => e.type)).toEqual(['stick', 'stick', 'stick']);
  expect(doc.elements.map((e) => (e.type === 'stick' ? e.angle : null))).toEqual([10, 55, 100]);
  expect(doc.elements.map((e) => (e.type === 'stick' ? e.weight : null))).toEqual([8, 8, 8]);
  expect(doc.elements.every((e) => e.spin === true)).toBe(true);
});

test('chip reach becomes a scale, and chipWeight is dropped', () => {
  const doc = toDoc({ ...OLD, chipReach: 12, bareWeight: 8, chipWeight: 8 });

  expect(doc.variants.chip?.scale).toBeCloseTo(12 / BARE_REACH, 10);
  expect(JSON.stringify(doc)).not.toContain('chipWeight');
});

test('the chip colour becomes an ink, dark in both themes', () => {
  const doc = toDoc({ ...OLD, chip: '#123456' });
  expect(doc.inks.field).toEqual({ light: '#123456', dark: '#123456' });
  expect(doc.variants.chip?.field).toEqual({ ink: 'field', radius: 11 });
});

test('a document that is already migrated passes through unchanged', () => {
  expect(toDoc(DEFAULT_DOC)).toEqual(DEFAULT_DOC);
});

test('a half-built object is not mistaken for a document', () => {
  expect(toDoc({ elements: [], inks: {} })).toEqual(DEFAULT_DOC);
  expect(toDoc({ elements: [], inks: {}, variants: {} })).toEqual(DEFAULT_DOC);
  expect(toDoc({ elements: [], inks: {}, variants: {}, motion: {} })).toEqual(DEFAULT_DOC);
});

test('anything unrecognisable falls back to the default document', () => {
  // A hand-broken file must not produce a half-built document that then renders
  // as an empty icon.
  expect(toDoc(null)).toEqual(DEFAULT_DOC);
  expect(toDoc({ nonsense: true })).toEqual(DEFAULT_DOC);
  expect(toDoc({ ...OLD, angles: [1, 2] })).toEqual(DEFAULT_DOC);
});
