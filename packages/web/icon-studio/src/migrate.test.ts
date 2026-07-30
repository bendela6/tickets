import { expect, test } from 'vitest';
import type { MarkConfig } from './config';
import { BARE_REACH, DEFAULT_DOC } from './doc';
import { configToDoc, toDoc } from './migrate';

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

test('configToDoc maps a MarkConfig 1:1, even where toDoc would reject it as invalid', () => {
  // bareWeight: 0 fails toDoc's `positive()` guard — unreachable from the
  // studio's own sliders, but exactly the kind of hand-edited value toDoc's
  // fallback-to-default posture exists to catch. configToDoc has no such
  // guard: the caller already holds a real, type-checked MarkConfig, so it
  // must carry every value through untouched rather than silently swapping in
  // the locked default mark's.
  const config: MarkConfig = {
    light: ['#111111', '#222222', '#333333'],
    dark: ['#444444', '#555555', '#666666'],
    chip: '#777777',
    angles: [1, 2, 3],
    bareWeight: 0,
    chipReach: 12,
    chipWeight: 4,
    motion: { speed: 10, restSpread: 1, ramp: 0.1, restPose: 'fan' },
  };

  // toDoc treats the zero weight as unrecognisable and falls all the way back.
  expect(toDoc(config)).toEqual(DEFAULT_DOC);

  // configToDoc carries the same config's values through as-is.
  const doc = configToDoc(config);
  expect(doc.elements.map((e) => (e.type === 'stick' ? e.angle : null))).toEqual([1, 2, 3]);
  expect(doc.elements.map((e) => (e.type === 'stick' ? e.weight : null))).toEqual([0, 0, 0]);
  expect(doc.inks.top).toEqual({ light: '#111111', dark: '#444444' });
  expect(doc.inks.mid).toEqual({ light: '#222222', dark: '#555555' });
  expect(doc.inks.low).toEqual({ light: '#333333', dark: '#666666' });
  expect(doc.inks.field).toEqual({ light: '#777777', dark: '#777777' });
  expect(doc.variants.chip?.scale).toBeCloseTo(12 / BARE_REACH, 10);
  expect(doc.motion).toEqual(config.motion);
});
