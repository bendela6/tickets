import { describe, expect, it } from 'vitest';
import { contrastRatio, grade, relativeLuminance } from './contrast';
import { emptyDocument, newObject } from './defaults';
import { safeZoneWarnings } from './validate';
import type { IconDoc, IconObject } from './types';

/** The 512-square board most of these fixtures assume. */
const BOARD = { width: 512, height: 512 };

const backdrop = (over: Partial<IconObject> = {}): IconObject => ({
  ...newObject('rect', 1, BOARD),
  name: 'backdrop',
  geometry: { kind: 'rect', x: 32, y: 32, w: 448, h: 448, radius: 96 },
  ...over,
});

const docOf = (objects: IconObject[]): IconDoc => ({ ...emptyDocument('test'), objects });

describe('safeZoneWarnings', () => {
  it('names the object and what it measures', () => {
    expect(safeZoneWarnings(docOf([backdrop()]))).toEqual([
      { id: 'rect-1', name: 'backdrop', percent: 88 },
    ]);
  });

  it('says nothing about an object inside the zone', () => {
    const inside = backdrop({
      geometry: { kind: 'rect', x: 100, y: 100, w: 312, h: 312, radius: 0 },
    });
    expect(safeZoneWarnings(docOf([inside]))).toEqual([]);
  });

  it('ignores hidden objects — they are not in the picture', () => {
    expect(safeZoneWarnings(docOf([backdrop({ hidden: true })]))).toEqual([]);
  });

  it('still warns about a locked object — locking does not make it safe', () => {
    expect(safeZoneWarnings(docOf([backdrop({ locked: true })]))).toHaveLength(1);
  });

  it('reports in document order, so the first offender is the frontmost', () => {
    const front = backdrop({ id: 'front', name: 'front' });
    const back = backdrop({ id: 'back', name: 'back' });
    expect(safeZoneWarnings(docOf([front, back])).map((w) => w.name)).toEqual(['front', 'back']);
  });

  it('measures against the document’s own size, not a fixed board', () => {
    // The same 448-box, centred, occupies far less of a 1024 board.
    const big: IconDoc = {
      ...emptyDocument('test', { width: 1024, height: 1024 }),
      objects: [backdrop({ geometry: { kind: 'rect', x: 288, y: 288, w: 448, h: 448, radius: 0 } })],
    };
    expect(safeZoneWarnings(big)).toEqual([]);
  });

  it('measures reach from the centre, so an off-centre object warns sooner', () => {
    // Same box as above, parked in the top-left quadrant instead of centred:
    // its far corner is now 480 of the 512 half-width away.
    const offCentre: IconDoc = {
      ...emptyDocument('test', { width: 1024, height: 1024 }),
      objects: [backdrop({ geometry: { kind: 'rect', x: 32, y: 32, w: 448, h: 448, radius: 0 } })],
    };
    expect(safeZoneWarnings(offCentre)).toEqual([
      { id: 'rect-1', name: 'backdrop', percent: 94 },
    ]);
  });
});

describe('contrast', () => {
  it('puts black and white at the extremes of luminance', () => {
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#ffffff')).toBe(1);
  });

  it('black on white is the maximum 21:1, and a colour against itself is 1:1', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#4e46c6', '#4e46c6')).toBeCloseTo(1, 5);
  });

  it('is symmetric', () => {
    expect(contrastRatio('#4e46c6', '#ffffff')).toBeCloseTo(contrastRatio('#ffffff', '#4e46c6'), 9);
  });

  it('accepts the short hex form', () => {
    expect(relativeLuminance('#fff')).toBe(relativeLuminance('#ffffff'));
  });

  it('reads unparseable input as black rather than NaN', () => {
    expect(relativeLuminance('not a colour')).toBe(0);
  });

  it('grades at the WCAG thresholds', () => {
    expect(grade(21)).toBe('AAA');
    expect(grade(7)).toBe('AAA');
    expect(grade(6.99)).toBe('AA');
    expect(grade(4.5)).toBe('AA');
    expect(grade(4.49)).toBe('AA LG');
    expect(grade(3)).toBe('AA LG');
    expect(grade(2.99)).toBe('LOW');
  });
});
