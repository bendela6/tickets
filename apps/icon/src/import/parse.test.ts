import { describe, expect, it } from 'vitest';
import {
  applyMatrix,
  parseColour,
  parseLength,
  parseNumbers,
  parsePathData,
  parseSvg,
  parseTransform,
} from './parse';

const segmentsOf = (d: string) => parsePathData(d).segments;

describe('parseSvg', () => {
  it('reads a well-formed file into a tree of elements', () => {
    const outcome = parseSvg('<svg viewBox="0 0 24 24"><g><rect width="4" height="4"/></g></svg>');
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.root.tag).toBe('svg');
    expect(outcome.root.attrs['viewBox']).toBe('0 0 24 24');
    expect(outcome.root.children[0]?.tag).toBe('g');
    expect(outcome.root.children[0]?.children[0]?.attrs['width']).toBe('4');
  });

  it('fails a malformed file with a message rather than throwing', () => {
    const outcome = parseSvg('<svg><rect></svg>');
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.message).toContain('well-formed');
  });

  it('fails a file whose root is not an svg', () => {
    const outcome = parseSvg('<html><body/></html>');
    expect(outcome).toEqual({ ok: false, message: 'the root element is <html> rather than <svg>' });
  });

  it('fails an empty file', () => {
    expect(parseSvg('   ')).toEqual({ ok: false, message: 'the file is empty' });
  });

  it('keeps element names in the case they were written in', () => {
    const outcome = parseSvg('<svg><clipPath/></svg>');
    expect(outcome.ok && outcome.root.children[0]?.tag).toBe('clipPath');
  });

  it('lets inline style beat the presentation attribute of the same name', () => {
    const outcome = parseSvg('<svg><rect fill="red" style="fill: #0f0; stroke-width: 3"/></svg>');
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const attrs = outcome.root.children[0]?.attrs ?? {};
    expect(attrs['fill']).toBe('#0f0');
    expect(attrs['stroke-width']).toBe('3');
  });
});

describe('parsePathData', () => {
  it('reads absolute commands as themselves', () => {
    expect(segmentsOf('M 10 20 L 30 40 Z')).toEqual([
      { c: 'M', x: 10, y: 20 },
      { c: 'L', x: 30, y: 40 },
      { c: 'Z' },
    ]);
  });

  it('turns relative commands into absolute ones', () => {
    expect(segmentsOf('m 10 10 l 5 0 l 0 5')).toEqual([
      { c: 'M', x: 10, y: 10 },
      { c: 'L', x: 15, y: 10 },
      { c: 'L', x: 15, y: 15 },
    ]);
  });

  it('measures a relative command after a closepath from the start of the subpath', () => {
    expect(segmentsOf('M 10 10 l 10 0 Z l 0 10')).toEqual([
      { c: 'M', x: 10, y: 10 },
      { c: 'L', x: 20, y: 10 },
      { c: 'Z' },
      { c: 'L', x: 10, y: 20 },
    ]);
  });

  it('gives H and V the coordinate they leave out', () => {
    expect(segmentsOf('M 4 4 H 10 V 20 h -2 v -4')).toEqual([
      { c: 'M', x: 4, y: 4 },
      { c: 'L', x: 10, y: 4 },
      { c: 'L', x: 10, y: 20 },
      { c: 'L', x: 8, y: 20 },
      { c: 'L', x: 8, y: 16 },
    ]);
  });

  it('repeats the command in force, and repeats an M as an L', () => {
    expect(segmentsOf('M 0 0 10 10 20 0')).toEqual([
      { c: 'M', x: 0, y: 0 },
      { c: 'L', x: 10, y: 10 },
      { c: 'L', x: 20, y: 0 },
    ]);
  });

  it('reads numbers packed against a command with no separator', () => {
    expect(segmentsOf('M0 0L10 10')).toEqual([
      { c: 'M', x: 0, y: 0 },
      { c: 'L', x: 10, y: 10 },
    ]);
  });

  it('reads a sign as a separator', () => {
    expect(segmentsOf('M10-5L1-2')).toEqual([
      { c: 'M', x: 10, y: -5 },
      { c: 'L', x: 1, y: -2 },
    ]);
  });

  it('reads a second point that begins with its own decimal point', () => {
    expect(segmentsOf('M.5.5L1.5.25')).toEqual([
      { c: 'M', x: 0.5, y: 0.5 },
      { c: 'L', x: 1.5, y: 0.25 },
    ]);
  });

  it('reads exponent notation', () => {
    expect(segmentsOf('M 1e2 -1.5e-1')).toEqual([{ c: 'M', x: 100, y: -0.15 }]);
  });

  it('reflects the previous control point for S, which is what keeps the join smooth', () => {
    const segments = segmentsOf('M 0 0 C 10 0 20 10 20 20 S 0 40 -10 40');
    const first = segments[1];
    const second = segments[2];
    expect(first?.c).toBe('C');
    expect(second).toEqual({ c: 'C', x1: 20, y1: 30, x2: 0, y2: 40, x: -10, y: 40 });
    if (first?.c !== 'C' || second?.c !== 'C') return;
    // The join is smooth exactly when the incoming and outgoing handles run in
    // the same direction: the control before the joint, the joint, and the
    // control after it are collinear and evenly spaced.
    expect(second.x1 - first.x).toBe(first.x - first.x2);
    expect(second.y1 - first.y).toBe(first.y - first.y2);
  });

  it('reflects a relative s against the pen, not the origin', () => {
    expect(segmentsOf('M 0 0 C 10 0 20 10 20 20 s -20 20 -30 20')).toEqual([
      { c: 'M', x: 0, y: 0 },
      { c: 'C', x1: 10, y1: 0, x2: 20, y2: 10, x: 20, y: 20 },
      { c: 'C', x1: 20, y1: 30, x2: 0, y2: 40, x: -10, y: 40 },
    ]);
  });

  it('starts an S from the current point when nothing precedes it to reflect', () => {
    expect(segmentsOf('M 5 5 S 10 10 20 20')).toEqual([
      { c: 'M', x: 5, y: 5 },
      { c: 'C', x1: 5, y1: 5, x2: 10, y2: 10, x: 20, y: 20 },
    ]);
  });

  it('reflects the previous control point for T', () => {
    expect(segmentsOf('M 0 0 Q 10 0 10 10 T 20 20 T 30 10')).toEqual([
      { c: 'M', x: 0, y: 0 },
      { c: 'Q', x1: 10, y1: 0, x: 10, y: 10 },
      // 10,0 reflected through 10,10.
      { c: 'Q', x1: 10, y1: 20, x: 20, y: 20 },
      // and that one reflected through 20,20 in turn.
      { c: 'Q', x1: 30, y1: 20, x: 30, y: 10 },
    ]);
  });

  it('forgets the reflection when a line comes between two curves', () => {
    const segments = segmentsOf('M 0 0 Q 10 0 10 10 L 20 10 T 30 20');
    expect(segments[3]).toEqual({ c: 'Q', x1: 20, y1: 10, x: 30, y: 20 });
  });

  it('reads arc flags written with no separators at all', () => {
    expect(segmentsOf('M 5 5 a1 1 0 011 1')).toEqual([
      { c: 'M', x: 5, y: 5 },
      { c: 'A', rx: 1, ry: 1, rotation: 0, large: false, sweep: true, x: 6, y: 6 },
    ]);
  });

  it('reads arc flags written apart, with a large-arc of 1', () => {
    expect(segmentsOf('M 0 0 A 5 10 30 1 0 20 20')).toEqual([
      { c: 'M', x: 0, y: 0 },
      { c: 'A', rx: 5, ry: 10, rotation: 30, large: true, sweep: false, x: 20, y: 20 },
    ]);
  });

  it('keeps what parsed and names what stopped it', () => {
    const parsed = parsePathData('M 0 0 L 10 10 X 5 5');
    expect(parsed.segments).toHaveLength(2);
    expect(parsed.error).toBe('"X" is not a path command');
  });

  it('names a command that runs out of coordinates', () => {
    const parsed = parsePathData('M 0 0 L 10');
    expect(parsed.segments).toEqual([{ c: 'M', x: 0, y: 0 }]);
    expect(parsed.error).toContain('lineto');
  });

  it('names a path that begins with a number', () => {
    expect(parsePathData('10 10 L 20 20').error).toContain('starts with a number');
  });

  it('reads an empty d as no commands and no complaint', () => {
    expect(parsePathData('   ')).toEqual({ segments: [], error: null });
  });
});

describe('parseNumbers', () => {
  it('reads a point list however it is punctuated', () => {
    expect(parseNumbers('0,0 10 10,-5-5')).toEqual([0, 0, 10, 10, -5, -5]);
  });
});

describe('parseTransform', () => {
  const at = (text: string, x: number, y: number) => applyMatrix(parseTransform(text).matrix, { x, y });

  it('moves a point by a translate', () => {
    expect(at('translate(10 5)', 1, 1)).toEqual({ x: 11, y: 6 });
  });

  it('takes a single scale argument as both axes', () => {
    expect(at('scale(3)', 2, 4)).toEqual({ x: 6, y: 12 });
  });

  it('turns about a stated centre', () => {
    const point = at('rotate(90 10 10)', 20, 10);
    expect(point.x).toBeCloseTo(10, 9);
    expect(point.y).toBeCloseTo(20, 9);
  });

  it('reads a matrix in SVG order', () => {
    expect(at('matrix(2 0 0 3 5 7)', 1, 1)).toEqual({ x: 7, y: 10 });
  });

  it('slants along x for a skewX', () => {
    const point = at('skewX(45)', 0, 2);
    expect(point.x).toBeCloseTo(2, 9);
    expect(point.y).toBe(2);
  });

  it('slants along y for a skewY', () => {
    const point = at('skewY(45)', 2, 0);
    expect(point.y).toBeCloseTo(2, 9);
  });

  it('composes left to right, so the rightmost function is applied first', () => {
    expect(at('translate(10 0) scale(2)', 1, 0)).toEqual({ x: 12, y: 0 });
    expect(at('scale(2) translate(10 0)', 1, 0)).toEqual({ x: 22, y: 0 });
  });

  it('names a function it does not read, and ignores it', () => {
    const parsed = parseTransform('translate(5 5) shear(2)');
    expect(parsed.error).toBe('shear() is not a transform this reads');
    expect(applyMatrix(parsed.matrix, { x: 0, y: 0 })).toEqual({ x: 5, y: 5 });
  });
});

describe('parseColour', () => {
  it('expands hex shorthand', () => {
    expect(parseColour('#0f8')).toEqual({ kind: 'colour', hex: '#00FF88' });
  });

  it('upper-cases six-digit hex', () => {
    expect(parseColour('#4e46c6')).toEqual({ kind: 'colour', hex: '#4E46C6' });
  });

  it('reads a named colour', () => {
    expect(parseColour('rebeccapurple')).toEqual({ kind: 'colour', hex: '#663399' });
    expect(parseColour(' Tomato ')).toEqual({ kind: 'colour', hex: '#FF6347' });
  });

  it('reads an rgb() triple', () => {
    expect(parseColour('rgb(255, 0, 16)')).toEqual({ kind: 'colour', hex: '#FF0010' });
  });

  it('reads none, and transparent as the same thing', () => {
    expect(parseColour('none')).toEqual({ kind: 'none' });
    expect(parseColour('transparent')).toEqual({ kind: 'none' });
  });

  it('refuses what it cannot turn into a hex pair', () => {
    expect(parseColour('url(#gradient)')).toEqual({ kind: 'unreadable', text: 'url(#gradient)' });
    expect(parseColour('hsl(200 50% 50%)').kind).toBe('unreadable');
    expect(parseColour('rgb(50%, 0%, 0%)').kind).toBe('unreadable');
  });
});

describe('parseLength', () => {
  it('drops an absolute unit, since a document has only its own units', () => {
    expect(parseLength('24px')).toBe(24);
    expect(parseLength(' 1.5 ')).toBe(1.5);
  });

  it('refuses a percentage, which needs a viewport to mean anything', () => {
    expect(parseLength('50%')).toBeNull();
    expect(parseLength(undefined)).toBeNull();
  });
});
