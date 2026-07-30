import { describe, expect, test } from 'vitest';
import { BARE_REACH, DEFAULT_DOC, type IconDoc } from '../doc';
import { outerExtent, renderSvg, SAFE_ZONE_PCT, safeZonePct } from './render';

function docWith(elements: IconDoc['elements']): IconDoc {
  return { ...DEFAULT_DOC, elements };
}

/**
 * Ported from the retired `generate/svg.ts`'s test suite (Task 7): properties
 * that suite proved once per hardcoded favicon/bare/mono/chip function, and
 * this one proves once, generically, across every variant a document
 * actually declares.
 */
describe('every built-in variant (ported from svg.test.ts)', () => {
  test('is one well-formed svg with every element drawn once', () => {
    for (const name of Object.keys(DEFAULT_DOC.variants)) {
      const svg = renderSvg(DEFAULT_DOC, name);
      expect(svg.match(/<svg/g), name).toHaveLength(1);
      expect(svg.match(/<\/svg>/g), name).toHaveLength(1);
      expect(svg.match(/<path/g), name).toHaveLength(DEFAULT_DOC.elements.length);
      expect(svg, name).toContain('xmlns="http://www.w3.org/2000/svg"');
      expect(svg, name).toContain('viewBox="0 0 48 48"');
    }
  });

  test('honours each element\'s own angle', () => {
    const doc: IconDoc = {
      ...DEFAULT_DOC,
      elements: [
        { id: 'a', type: 'stick', ink: 'top', angle: 5, reach: 18, weight: 6 },
        { id: 'b', type: 'stick', ink: 'mid', angle: 37, reach: 18, weight: 6 },
        { id: 'c', type: 'stick', ink: 'low', angle: 155, reach: 18, weight: 6 },
      ],
    };
    for (const name of Object.keys(doc.variants)) {
      const svg = renderSvg(doc, name);
      expect(svg, name).toContain('rotate(5 24 24)');
      expect(svg, name).toContain('rotate(37 24 24)');
      expect(svg, name).toContain('rotate(155 24 24)');
    }
  });

  test('the apple variant is square where chip is rounded', () => {
    expect(renderSvg(DEFAULT_DOC, 'chip')).toContain('rx="11"');
    expect(renderSvg(DEFAULT_DOC, 'apple')).toContain('rx="0"');
  });

  test('the chip mark sits inside the android maskable safe circle', () => {
    expect(safeZonePct(DEFAULT_DOC, 'chip')).toBeLessThan(SAFE_ZONE_PCT);
  });
});

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

  test('elements are painted in reverse document order, so the first element is frontmost', () => {
    const svg = renderSvg(
      docWith([
        { id: 'front', type: 'ring', ink: 'low', radius: 15, weight: 3 },
        { id: 'back', type: 'dot', ink: 'top', at: [24, 24], radius: 4 },
      ]),
      'mono',
    );
    // The ring is elements[0] — frontmost — so it is emitted last; the dot's
    // r="4" (elements[1], backmost) appears earlier in the document.
    expect(svg.indexOf('r="4"')).toBeLessThan(svg.indexOf('r="15"'));
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

  test('theme resolution inlines every element\'s own ink, light and dark, not only the first', () => {
    const svg = renderSvg(DEFAULT_DOC, 'favicon');
    const usedInks = new Set(DEFAULT_DOC.elements.map((e) => e.ink));
    for (const name of usedInks) {
      const pair = DEFAULT_DOC.inks[name];
      expect(pair, name).toBeDefined();
      if (!pair) continue;
      expect(svg, name).toContain(pair.light);
      expect(svg, name).toContain(pair.dark);
    }
  });

  test('a theme class label is pinned to document index, not paint position', () => {
    // Three distinct inks so a swapped label would be visible, not coincidental.
    const doc: IconDoc = {
      ...DEFAULT_DOC,
      elements: [
        { id: 'a', type: 'stick', ink: 'top', angle: 0, reach: 18, weight: 6 },
        { id: 'b', type: 'stick', ink: 'mid', angle: 30, reach: 18, weight: 6 },
        { id: 'c', type: 'stick', ink: 'low', angle: 60, reach: 18, weight: 6 },
      ],
      variants: { v: { inks: 'theme', scale: 1 } },
    };
    const svg = renderSvg(doc, 'v');

    // Document element 0 (angle 0, ink 'top') must carry class="s1" in the
    // markup, regardless of where the reverse paint places it in the file.
    const element0Path = svg.split('\n').find((line) => line.includes('rotate(0 24 24)'));
    expect(element0Path).toContain('class="s1"');

    // And the .s1 rule must resolve element 0's own ink ('top'), not
    // whichever element happens to land in that paint position.
    const topLight = DEFAULT_DOC.inks.top?.light ?? '';
    expect(topLight).not.toBe('');
    expect(svg).toContain(`.s1{stroke:${topLight}}`);
  });

  test('an element naming a missing ink renders black rather than crashing', () => {
    const svg = renderSvg(
      docWith([{ id: 'a', type: 'stick', ink: 'nope', angle: 0, reach: 18, weight: 6 }]),
      'mono',
    );
    expect(svg).toContain('#000');
  });

  test('a missing ink falls back to black under a resolution that actually reads doc.inks', () => {
    // 'mono' resolves to 'black', which short-circuits before ever touching
    // doc.inks — it can't exercise the fallback. 'dark' (like chip) does.
    const doc: IconDoc = {
      ...DEFAULT_DOC,
      elements: [{ id: 'a', type: 'stick', ink: 'nope', angle: 0, reach: 18, weight: 6 }],
      variants: { v: { inks: 'dark', scale: 1 } },
    };
    expect(() => renderSvg(doc, 'v')).not.toThrow();
    expect(renderSvg(doc, 'v')).toContain('#000');
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
