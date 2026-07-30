import { render } from '@testing-library/react';
import { expect, test } from 'vitest';
import config from '../../../icons.config.json';
import { BRAND_MARK_CSS, BrandMark, stickGeometry } from './brand-mark';

// Every expectation below is derived from icons.config.json rather than
// restating its values, so retuning the mark in the studio can never leave
// this file asserting a mark the app no longer draws.

interface Ink {
  light: string;
  dark: string;
}

interface StickElement {
  id: string;
  ink: string;
  angle: number;
  reach: number;
  weight: number;
}

const inks = config.inks as Record<string, Ink>;

// The committed document is all sticks today, so this file doesn't need
// BrandMark's `isStick` guard — it only has to describe the fixture it
// reads, not defend against a shape the fixture doesn't have.
const elements = config.elements as StickElement[];

/** `elements[0]` paints frontmost — see brand-mark.tsx and render.ts. */
const paintOrder = [...elements].reverse();

function sticks(container: HTMLElement): Element[] {
  return [...container.querySelectorAll('svg path')];
}

function svgOf(container: HTMLElement): Element {
  const svg = container.querySelector('svg');
  if (!svg) throw new Error('BrandMark rendered no <svg>');
  return svg;
}

test('draws one stick per element, in reverse document order so element[0] paints frontmost', () => {
  const { container } = render(<BrandMark />);

  expect(sticks(container).map((p) => p.getAttribute('transform'))).toEqual(
    paintOrder.map((element) => `rotate(${element.angle} 24 24)`),
  );
});

test('gives each stick its own custom property, keyed by id, in that same paint order', () => {
  const { container } = render(<BrandMark />);

  expect(sticks(container).map((p) => p.getAttribute('stroke'))).toEqual(
    paintOrder.map((element) => `var(--brand-${element.id})`),
  );
});

test('draws the favicon geometry: a full diameter at each element’s configured weight', () => {
  const { container } = render(<BrandMark />);
  const drawn = sticks(container);

  // The exact path and weight the generated favicon.svg carries — same drawing,
  // not a lookalike.
  expect(drawn.map((p) => p.getAttribute('d'))).toEqual(
    paintOrder.map((element) => `M24 ${24 - element.reach}L24 ${24 + element.reach}`),
  );
  expect(drawn.map((p) => p.getAttribute('stroke-width'))).toEqual(
    paintOrder.map((element) => String(element.weight)),
  );
});

test('re-points the same custom properties for dark rather than redrawing anything', () => {
  const lightProps = elements.map((element) => `--brand-${element.id}:${inks[element.ink]?.light}`).join(';');
  const darkProps = elements.map((element) => `--brand-${element.id}:${inks[element.ink]?.dark}`).join(';');

  expect(BRAND_MARK_CSS).toContain(`:root,[data-theme='light']{${lightProps}}`);
  expect(BRAND_MARK_CSS).toContain(`[data-theme='dark']{${darkProps}}`);
});

test('scales from the size prop without touching the drawing', () => {
  const { container } = render(<BrandMark size={18} />);
  const svg = svgOf(container);

  expect(svg.getAttribute('width')).toBe('18');
  expect(svg.getAttribute('height')).toBe('18');
  expect(svg.getAttribute('viewBox')).toBe('0 0 48 48');
});

test('publishes the theme block into the document, so the strokes resolve', () => {
  render(<BrandMark />);

  const published = [...document.querySelectorAll('style')].filter((s) =>
    s.textContent?.includes('--brand-'),
  );
  expect(published.length).toBeGreaterThan(0);
});

// The committed fixture's favicon variant is scale 1 (see icons.config.json),
// so a rendering test against it alone can't distinguish "the scale is
// applied, and happens to be 1" from "the scale is ignored outright" — that
// is exactly the gap between this file's header comment (claims parity with
// renderSvg's favicon variant) and the code (used to read reach/weight raw).
// `stickGeometry` is exported specifically so the multiplication itself can
// be pinned independent of the fixture.
test('stickGeometry holds reach and weight to renderSvg\'s own scale multiplier', () => {
  expect(stickGeometry({ reach: 18, weight: 6 }, 1)).toEqual({ d: 'M24 6L24 42', strokeWidth: 6 });
  expect(stickGeometry({ reach: 10, weight: 4 }, 2)).toEqual({ d: 'M24 4L24 44', strokeWidth: 8 });
  expect(stickGeometry({ reach: 18, weight: 6 }, 0.5)).toEqual({ d: 'M24 15L24 33', strokeWidth: 3 });
});
