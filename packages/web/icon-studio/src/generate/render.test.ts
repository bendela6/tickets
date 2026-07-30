import { describe, expect, test } from 'vitest';
import { BARE_REACH, DEFAULT_DOC, type IconDoc } from '../doc';
import { outerExtent, renderSvg, safeZonePct } from './render';

function docWith(elements: IconDoc['elements']): IconDoc {
  return { ...DEFAULT_DOC, elements };
}

describe('primitives', () => {
  test('a stick is a full diameter, rotated about the centre', () => {
    const svg = renderSvg(
      docWith([{ id: 'a', type: 'stick', ink: 'top', angle: 62, reach: 18, weight: 6 }]),
      'mono',
    );
    expect(svg).toContain('d="M24 6L24 42"');
    expect(svg).toContain('stroke-width="6"');
    expect(svg).toContain('transform="rotate(62 24 24)"');
    expect(svg).toContain('stroke-linecap="round"');
  });

  test('a ring is one concentric circle, stroked and unfilled', () => {
    const svg = renderSvg(
      docWith([{ id: 'a', type: 'ring', ink: 'top', radius: 15, weight: 3 }]),
      'mono',
    );
    expect(svg).toContain('<circle cx="24" cy="24" r="15"');
    expect(svg).toContain('stroke-width="3"');
    expect(svg).toContain('fill="none"');
    expect(svg.match(/<circle/g)).toHaveLength(1);
  });

  test('a dot is one filled circle at its own point', () => {
    const svg = renderSvg(
      docWith([{ id: 'a', type: 'dot', ink: 'top', at: [10, 38], radius: 4 }]),
      'mono',
    );
    expect(svg).toContain('<circle cx="10" cy="38" r="4"');
    expect(svg).toContain('fill="#000"');
    expect(svg).not.toContain('stroke-width');
  });

  test('elements are painted in document order, back to front', () => {
    const svg = renderSvg(
      docWith([
        { id: 'back', type: 'ring', ink: 'low', radius: 15, weight: 3 },
        { id: 'front', type: 'dot', ink: 'top', at: [24, 24], radius: 4 },
      ]),
      'mono',
    );
    expect(svg.indexOf('r="15"')).toBeLessThan(svg.indexOf('r="4"'));
  });
});

describe('ink resolution', () => {
  test('mono resolves every ink to black', () => {
    const svg = renderSvg(DEFAULT_DOC, 'mono');
    expect(svg).toContain('#000');
    expect(svg).not.toContain('#7167ff');
    expect(svg).not.toContain('#6652ff');
  });

  test('chip resolves every ink to its dark value and draws the field', () => {
    const svg = renderSvg(DEFAULT_DOC, 'chip');
    expect(svg).toContain('#6652ff');
    expect(svg).not.toContain('#7167ff');
    expect(svg).toContain('<rect width="48" height="48" rx="11" fill="#1b1830"/>');
  });

  test('theme emits both sets, swapped by a media query', () => {
    const svg = renderSvg(DEFAULT_DOC, 'favicon');
    expect(svg).toContain('#7167ff');
    expect(svg).toContain('#6652ff');
    expect(svg).toContain('@media (prefers-color-scheme:dark)');
  });

  test('an element naming a missing ink renders black rather than crashing', () => {
    const svg = renderSvg(
      docWith([{ id: 'a', type: 'stick', ink: 'nope', angle: 0, reach: 18, weight: 6 }]),
      'mono',
    );
    expect(svg).toContain('#000');
  });
});

describe('scale', () => {
  test('scale multiplies reach and weight together, holding the ratio', () => {
    const doc: IconDoc = {
      ...DEFAULT_DOC,
      variants: { half: { inks: 'dark', scale: 0.5 } },
    };
    const svg = renderSvg(doc, 'half');
    // reach 18 -> 9, so the stick runs 24-9 .. 24+9; weight 6 -> 3.
    expect(svg).toContain('d="M24 15L24 33"');
    expect(svg).toContain('stroke-width="3"');
  });

  test('the weight-to-reach ratio is invariant under any scale', () => {
    for (const scale of [0.25, 0.5, 14 / 18, 1, 1.5]) {
      const doc: IconDoc = { ...DEFAULT_DOC, variants: { v: { inks: 'dark', scale } } };
      const svg = renderSvg(doc, 'v');
      // Signed: scale 1.5 pushes reach past CENTRE, so this coordinate goes negative.
      const reach = Number(/M24 (-?\d+(?:\.\d+)?)L/.exec(svg)?.[1] ?? NaN);
      const weight = Number(/stroke-width="(\d+(?:\.\d+)?)"/.exec(svg)?.[1] ?? NaN);
      // The stick starts at CENTRE - reach.
      expect(weight / (24 - reach)).toBeCloseTo(6 / BARE_REACH, 10);
    }
  });

  test('the maskable safe zone follows from the scale', () => {
    // Outer extent is reach plus half the stroke cap.
    expect(outerExtent(DEFAULT_DOC, 'chip')).toBeCloseTo((18 + 3) * (14 / 18), 6);
    expect(safeZonePct(DEFAULT_DOC, 'chip')).toBeCloseTo(
      ((18 + 3) * (14 / 18) * 100) / 24,
      6,
    );
  });
});

test('an unknown variant name throws rather than rendering something arbitrary', () => {
  expect(() => renderSvg(DEFAULT_DOC, 'nope')).toThrow(/nope/);
});
